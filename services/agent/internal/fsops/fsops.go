// Package fsops implements the Agent's file manager (§33) with path
// traversal prevention as its central concern. Every function here takes a
// server root and a client-supplied relative path, and the *only* way to
// get a usable absolute path out of this package is through Resolve, which
// refuses anything that would escape the root — including via symlinks.
package fsops

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

var ErrPathEscapesRoot = errors.New("path escapes server root")

// Resolve turns a client-supplied relative path into a safe absolute path
// inside root, or returns ErrPathEscapesRoot. Defense in depth, in order:
//  1. Reject null bytes and absolute paths outright.
//  2. filepath.Clean to collapse "." and ".." segments syntactically.
//  3. Join with root and verify the cleaned result still has root as a
//     prefix (catches ".." sequences Clean would otherwise resolve to
//     outside root).
//  4. Resolve symlinks (EvalSymlinks) on the deepest existing ancestor and
//     re-verify the *resolved* path is still inside root — this is what
//     stops a symlink placed inside the server directory from pointing
//     somewhere else on disk (e.g. a plugin that drops a symlink to
///    /etc/shadow and then a "read file" request follows it).
func Resolve(root, relPath string) (string, error) {
	if strings.Contains(relPath, "\x00") {
		return "", ErrPathEscapesRoot
	}
	if filepath.IsAbs(relPath) {
		return "", ErrPathEscapesRoot
	}

	// Resolve symlinks in the root itself up front (e.g. a storage mount,
	// or macOS's /var -> /private/var) so it's compared on equal footing
	// with the symlink-resolved target path below — otherwise a perfectly
	// legitimate in-root path can be misjudged as escaping.
	rootAbs, err := canonicalRoot(root)
	if err != nil {
		return "", err
	}

	joined := filepath.Join(rootAbs, relPath)
	cleaned := filepath.Clean(joined)
	if cleaned != rootAbs && !strings.HasPrefix(cleaned, rootAbs+string(filepath.Separator)) {
		return "", ErrPathEscapesRoot
	}

	resolved, err := resolveSymlinksWithinRoot(rootAbs, cleaned)
	if err != nil {
		return "", err
	}
	return resolved, nil
}

// resolveSymlinksWithinRoot walks up from `target` to find the deepest
// existing ancestor, resolves symlinks up to that point, and re-verifies
// the result is still under root. If nothing along the path exists yet
// (e.g. this is a "create file" call), it resolves as much of the parent
// chain as does exist and trusts the rest, since there's no symlink to
// have followed for path components that don't exist.
func resolveSymlinksWithinRoot(rootAbs, target string) (string, error) {
	existing := target
	var suffix []string
	for {
		if _, err := os.Lstat(existing); err == nil {
			break
		}
		parent := filepath.Dir(existing)
		if parent == existing {
			break // reached filesystem root without finding anything that exists
		}
		suffix = append([]string{filepath.Base(existing)}, suffix...)
		existing = parent
	}

	resolvedExisting, err := filepath.EvalSymlinks(existing)
	if err != nil {
		// existing itself doesn't exist (e.g. root not created yet) — fall
		// back to the syntactic path; the caller's subsequent os.* call
		// will fail naturally if that's actually a problem.
		resolvedExisting = existing
	}
	resolvedExisting = filepath.Clean(resolvedExisting)

	if resolvedExisting != rootAbs && !strings.HasPrefix(resolvedExisting, rootAbs+string(filepath.Separator)) {
		return "", ErrPathEscapesRoot
	}

	full := resolvedExisting
	if len(suffix) > 0 {
		full = filepath.Join(append([]string{resolvedExisting}, suffix...)...)
	}
	full = filepath.Clean(full)
	if full != rootAbs && !strings.HasPrefix(full, rootAbs+string(filepath.Separator)) {
		return "", ErrPathEscapesRoot
	}
	return full, nil
}

// canonicalRoot resolves root to its symlink-free absolute form — the same
// normalization Resolve applies internally — so callers that need to
// re-check a path against the root outside of Resolve (e.g. Delete's
// belt-and-suspenders EnsureWithinRoot call) compare against the same
// canonical value instead of an unresolved one.
func canonicalRoot(root string) (string, error) {
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return "", fmt.Errorf("resolving root: %w", err)
	}
	rootAbs = filepath.Clean(rootAbs)
	if resolved, err := filepath.EvalSymlinks(rootAbs); err == nil {
		rootAbs = filepath.Clean(resolved)
	}
	return rootAbs, nil
}

// EnsureWithinRoot re-validates an already-resolved absolute path is still
// inside root — used right before a destructive operation (delete/rename
// target) as a final check even though Resolve was already called, in case
// a symlink was created between validation and use (TOCTOU hardening for
// the highest-risk operations).
func EnsureWithinRoot(rootAbs, absPath string) error {
	resolved, err := filepath.EvalSymlinks(absPath)
	if err != nil {
		resolved = filepath.Clean(absPath)
	}
	rootAbs = filepath.Clean(rootAbs)
	if resolved != rootAbs && !strings.HasPrefix(resolved, rootAbs+string(filepath.Separator)) {
		return ErrPathEscapesRoot
	}
	return nil
}
