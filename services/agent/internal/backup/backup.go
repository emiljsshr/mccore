// Package backup implements local backup creation and restore (§38/§39)
// using tar + zstd (github.com/klauspost/compress/zstd — pure Go, no
// external `zstd` binary dependency, see docs/architecture.md).
package backup

import (
	"archive/tar"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/klauspost/compress/zstd"
)

type CreateOptions struct {
	IncludesWorlds  bool
	IncludesPlugins bool
	IncludesConfig  bool
	Compression     string // "none" | "fast" | "best"
}

type CreateResult struct {
	SizeBytes int64
	Sha256    string
}

// excludedTopLevel entries are never archived regardless of the requested
// include flags — they're large and fully regenerable.
var excludedTopLevel = map[string]bool{
	"logs":  true,
	"cache": true, // Paper/Purpur download/version cache
}

// Create tars+compresses the selected parts of serverDir into destPath.
// progress is called with a 0-100 estimate as entries are written; it's a
// best-effort estimate based on entry count, not exact bytes (computing
// exact totals would require a separate full filesystem walk first).
func Create(ctx context.Context, serverDir, destPath string, opts CreateOptions, progress func(percent float64)) (CreateResult, error) {
	entries, err := selectEntries(serverDir, opts)
	if err != nil {
		return CreateResult{}, err
	}

	tmp := destPath + ".tmp"
	if err := os.MkdirAll(filepath.Dir(tmp), 0755); err != nil {
		return CreateResult{}, fmt.Errorf("creating backup directory: %w", err)
	}
	out, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return CreateResult{}, fmt.Errorf("creating backup file: %w", err)
	}

	hasher := sha256.New()
	multi := io.MultiWriter(out, hasher)

	zw, err := zstd.NewWriter(multi, zstd.WithEncoderLevel(zstdLevel(opts.Compression)))
	if err != nil {
		out.Close()
		os.Remove(tmp)
		return CreateResult{}, fmt.Errorf("creating zstd writer: %w", err)
	}
	tw := tar.NewWriter(zw)

	total := len(entries)
	for i, entry := range entries {
		if ctx.Err() != nil {
			tw.Close()
			zw.Close()
			out.Close()
			os.Remove(tmp)
			return CreateResult{}, ctx.Err()
		}
		if err := addToTar(tw, serverDir, entry); err != nil {
			tw.Close()
			zw.Close()
			out.Close()
			os.Remove(tmp)
			return CreateResult{}, fmt.Errorf("archiving %s: %w", entry, err)
		}
		if progress != nil && total > 0 {
			progress(float64(i+1) / float64(total) * 100)
		}
	}

	if err := tw.Close(); err != nil {
		out.Close()
		os.Remove(tmp)
		return CreateResult{}, fmt.Errorf("finalizing tar: %w", err)
	}
	if err := zw.Close(); err != nil {
		out.Close()
		os.Remove(tmp)
		return CreateResult{}, fmt.Errorf("finalizing zstd stream: %w", err)
	}
	if err := out.Close(); err != nil {
		os.Remove(tmp)
		return CreateResult{}, fmt.Errorf("closing backup file: %w", err)
	}

	info, err := os.Stat(tmp)
	if err != nil {
		os.Remove(tmp)
		return CreateResult{}, err
	}
	if err := os.Rename(tmp, destPath); err != nil {
		os.Remove(tmp)
		return CreateResult{}, fmt.Errorf("finalizing backup: %w", err)
	}

	return CreateResult{SizeBytes: info.Size(), Sha256: hex.EncodeToString(hasher.Sum(nil))}, nil
}

func zstdLevel(compression string) zstd.EncoderLevel {
	switch compression {
	case "none":
		return zstd.SpeedFastest
	case "best":
		return zstd.SpeedBestCompression
	default:
		return zstd.SpeedDefault
	}
}

// selectEntries returns the top-level (relative to serverDir) paths to
// include, per §38's world/plugins/config split. A "world" is any
// top-level directory containing a level.dat — the standard Minecraft
// marker file — detected rather than assumed from a fixed name list, since
// custom `level-name` settings mean the primary world isn't always
// literally named "world".
func selectEntries(serverDir string, opts CreateOptions) ([]string, error) {
	topLevel, err := os.ReadDir(serverDir)
	if err != nil {
		return nil, fmt.Errorf("reading server directory: %w", err)
	}

	var entries []string
	for _, e := range topLevel {
		name := e.Name()
		if excludedTopLevel[name] || strings.HasSuffix(name, ".downloading") || strings.HasSuffix(name, ".tmp") {
			continue
		}
		if name == "stdin.fifo" {
			continue
		}

		if e.IsDir() {
			if name == "plugins" {
				if opts.IncludesPlugins {
					entries = append(entries, name)
				}
				continue
			}
			if isWorldDir(filepath.Join(serverDir, name)) {
				if opts.IncludesWorlds {
					entries = append(entries, name)
				}
				continue
			}
			if opts.IncludesConfig {
				entries = append(entries, name)
			}
			continue
		}

		if opts.IncludesConfig {
			entries = append(entries, name)
		}
	}
	return entries, nil
}

func isWorldDir(path string) bool {
	_, err := os.Stat(filepath.Join(path, "level.dat"))
	return err == nil
}

func addToTar(tw *tar.Writer, root, relEntry string) error {
	base := filepath.Join(root, relEntry)
	return filepath.WalkDir(base, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		info, err := d.Info()
		if err != nil {
			return err
		}

		if d.Type()&fs.ModeSymlink != 0 {
			// Symlinks inside a server directory are not followed into the
			// archive (§39 restore safety) — record them as a symlink tar
			// entry pointing at their original (relative) target instead of
			// dereferencing, so restore never writes outside its own tree
			// even if the *source* server had a suspicious symlink in it.
			target, err := os.Readlink(path)
			if err != nil {
				return err
			}
			hdr := &tar.Header{Name: filepath.ToSlash(rel), Typeflag: tar.TypeSymlink, Linkname: target, ModTime: info.ModTime()}
			return tw.WriteHeader(hdr)
		}

		hdr, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		hdr.Name = filepath.ToSlash(rel)
		if d.IsDir() {
			hdr.Name += "/"
		}
		if err := tw.WriteHeader(hdr); err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		f, err := os.Open(path)
		if err != nil {
			return err
		}
		defer f.Close()
		_, err = io.Copy(tw, f)
		return err
	})
}
