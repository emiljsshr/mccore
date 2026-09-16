package backup

import (
	"archive/tar"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/klauspost/compress/zstd"

	"github.com/cometa-mccore/mccore/services/agent/internal/fsops"
)

// VerifyChecksum re-hashes a backup file and compares against the
// recorded sha256 before any restore is attempted (§39 step 2).
func VerifyChecksum(backupPath, expectedSha256 string) error {
	f, err := os.Open(backupPath)
	if err != nil {
		return fmt.Errorf("opening backup: %w", err)
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return fmt.Errorf("hashing backup: %w", err)
	}
	got := hex.EncodeToString(h.Sum(nil))
	if got != expectedSha256 {
		return fmt.Errorf("backup checksum mismatch: expected %s, got %s (backup may be corrupt)", expectedSha256, got)
	}
	return nil
}

// Restore extracts backupPath into a fresh temp directory, then atomically
// swaps it in for serverDir (§39): the previous server directory is moved
// aside (kept, not deleted — it's the safety copy) rather than being
// overwritten in place, so a failed or interrupted restore can never leave
// a half-extracted server directory as the live one.
func Restore(ctx context.Context, backupPath, serverDir string) (safetyBackupDir string, err error) {
	restoreTmp := serverDir + ".restore-tmp"
	_ = os.RemoveAll(restoreTmp)
	if err := os.MkdirAll(restoreTmp, 0755); err != nil {
		return "", fmt.Errorf("creating restore staging directory: %w", err)
	}

	if err := extractTarZst(ctx, backupPath, restoreTmp); err != nil {
		os.RemoveAll(restoreTmp)
		return "", err
	}

	if _, statErr := os.Stat(serverDir); statErr == nil {
		candidate := fmt.Sprintf("%s.pre-restore-%d", serverDir, time.Now().Unix())
		if err := os.Rename(serverDir, candidate); err != nil {
			os.RemoveAll(restoreTmp)
			return "", fmt.Errorf("moving current server directory aside: %w", err)
		}
		safetyBackupDir = candidate
	}

	if err := os.Rename(restoreTmp, serverDir); err != nil {
		// Best-effort rollback: put the original back if the final swap failed.
		if safetyBackupDir != "" {
			_ = os.Rename(safetyBackupDir, serverDir)
		}
		return "", fmt.Errorf("swapping in restored server directory: %w", err)
	}

	return safetyBackupDir, nil
}

// extractTarZst decompresses and unpacks into destDir, validating every
// entry with fsops.Resolve so a maliciously (or corruptly) crafted archive
// entry — "../../etc/cron.d/x", an absolute path, or a symlink pointing
// outside destDir — can never write outside destDir (zip-slip protection,
// §39: "Nie direkt blind über Live-Dateien extrahieren").
func extractTarZst(ctx context.Context, backupPath, destDir string) error {
	f, err := os.Open(backupPath)
	if err != nil {
		return fmt.Errorf("opening backup: %w", err)
	}
	defer f.Close()

	zr, err := zstd.NewReader(f)
	if err != nil {
		return fmt.Errorf("opening zstd stream: %w", err)
	}
	defer zr.Close()

	tr := tar.NewReader(zr)
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("reading tar entry: %w", err)
		}

		target, err := fsops.Resolve(destDir, hdr.Name)
		if err != nil {
			return fmt.Errorf("archive entry %q rejected: %w", hdr.Name, err)
		}

		switch hdr.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0755); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return err
			}
			out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, os.FileMode(hdr.Mode&0777))
			if err != nil {
				return err
			}
			if _, err := io.Copy(out, tr); err != nil {
				out.Close()
				return err
			}
			out.Close()
		case tar.TypeSymlink:
			// Restored symlinks must resolve within destDir too — refuse
			// anything else rather than silently dropping it, since a
			// silently-dropped symlink could change server behavior in a
			// way nobody would notice happened.
			linkTarget, err := fsops.Resolve(destDir, filepath.ToSlash(filepath.Join(filepath.Dir(hdr.Name), hdr.Linkname)))
			if err != nil {
				return fmt.Errorf("symlink entry %q -> %q rejected: %w", hdr.Name, hdr.Linkname, err)
			}
			relTarget, err := filepath.Rel(filepath.Dir(target), linkTarget)
			if err != nil {
				return err
			}
			if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return err
			}
			if err := os.Symlink(relTarget, target); err != nil {
				return err
			}
		default:
			// Skip anything else (device files, etc.) — never expected in
			// a server directory, and definitely never something we should
			// materialize on disk from an archive.
			continue
		}
	}
	return nil
}
