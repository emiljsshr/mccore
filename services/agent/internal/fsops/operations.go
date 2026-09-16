package fsops

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"time"
)

// MaxInlineFileBytes bounds file.read/file.write over the WebSocket
// command channel (base64 JSON) — §34: no multi-GB files loaded into RAM
// via this path. Larger files need the (not yet built) dedicated streaming
// HTTP download/upload route; this limit keeps the text-editor use case
// working without risking the Agent's memory on an oversized request.
const MaxInlineFileBytes = 8 * 1024 * 1024

type Entry struct {
	Name        string
	Path        string // relative to server root, POSIX-style
	IsDir       bool
	SizeBytes   int64
	ModifiedAt  time.Time
	Permissions string
}

func List(root, relPath string) ([]Entry, error) {
	abs, err := Resolve(root, normalizeListPath(relPath))
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(abs)
	if err != nil {
		return nil, fmt.Errorf("reading directory: %w", err)
	}
	out := make([]Entry, 0, len(entries))
	for _, e := range entries {
		info, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, Entry{
			Name:        e.Name(),
			Path:        filepath.ToSlash(filepath.Join(relPath, e.Name())),
			IsDir:       e.IsDir(),
			SizeBytes:   info.Size(),
			ModifiedAt:  info.ModTime(),
			Permissions: strconv.FormatUint(uint64(info.Mode().Perm()), 8),
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].IsDir != out[j].IsDir {
			return out[i].IsDir // directories first
		}
		return out[i].Name < out[j].Name
	})
	return out, nil
}

func normalizeListPath(relPath string) string {
	if relPath == "" || relPath == "." || relPath == "/" {
		return "."
	}
	return relPath
}

func ReadFileBase64(root, relPath string) (string, error) {
	abs, err := Resolve(root, relPath)
	if err != nil {
		return "", err
	}
	info, err := os.Stat(abs)
	if err != nil {
		return "", fmt.Errorf("stat: %w", err)
	}
	if info.IsDir() {
		return "", fmt.Errorf("%s is a directory", relPath)
	}
	if info.Size() > MaxInlineFileBytes {
		return "", fmt.Errorf("file exceeds the %d byte inline read limit", MaxInlineFileBytes)
	}
	data, err := os.ReadFile(abs)
	if err != nil {
		return "", fmt.Errorf("reading file: %w", err)
	}
	return base64.StdEncoding.EncodeToString(data), nil
}

func WriteFileBase64(root, relPath, contentBase64 string) error {
	if len(contentBase64) > (MaxInlineFileBytes*4)/3+64 {
		return fmt.Errorf("payload exceeds the %d byte inline write limit", MaxInlineFileBytes)
	}
	data, err := base64.StdEncoding.DecodeString(contentBase64)
	if err != nil {
		return fmt.Errorf("invalid base64 content: %w", err)
	}
	if len(data) > MaxInlineFileBytes {
		return fmt.Errorf("file exceeds the %d byte inline write limit", MaxInlineFileBytes)
	}
	abs, err := Resolve(root, relPath)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0755); err != nil {
		return fmt.Errorf("creating parent directories: %w", err)
	}
	// Write to a temp file then rename, so a client that disconnects
	// mid-upload never leaves a half-written file in place of the original.
	tmp := abs + ".mccore-tmp"
	if err := os.WriteFile(tmp, data, 0644); err != nil {
		return fmt.Errorf("writing file: %w", err)
	}
	if err := os.Rename(tmp, abs); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("finalizing write: %w", err)
	}
	return nil
}

func Mkdir(root, relPath string) error {
	abs, err := Resolve(root, relPath)
	if err != nil {
		return err
	}
	return os.MkdirAll(abs, 0755)
}

func Delete(root, relPath string) error {
	if normalizeListPath(relPath) == "." {
		return fmt.Errorf("refusing to delete the server root")
	}
	abs, err := Resolve(root, relPath)
	if err != nil {
		return err
	}
	rootAbs, err := canonicalRoot(root)
	if err != nil {
		return err
	}
	if err := EnsureWithinRoot(rootAbs, abs); err != nil {
		return err
	}
	return os.RemoveAll(abs)
}

func Rename(root, relPath, newRelPath string) error {
	absOld, err := Resolve(root, relPath)
	if err != nil {
		return err
	}
	absNew, err := Resolve(root, newRelPath)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(absNew), 0755); err != nil {
		return fmt.Errorf("creating parent directories: %w", err)
	}
	return os.Rename(absOld, absNew)
}
