package fsops

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolve_RejectsTraversal(t *testing.T) {
	root := t.TempDir()
	cases := []string{
		"../outside",
		"../../etc/passwd",
		"a/../../b",
		"/etc/passwd",
		"a/b/../../../c",
	}
	for _, c := range cases {
		if _, err := Resolve(root, c); err == nil {
			t.Errorf("Resolve(%q) succeeded, want ErrPathEscapesRoot", c)
		}
	}
}

func TestResolve_AllowsWithinRoot(t *testing.T) {
	root := t.TempDir()
	cases := []string{"file.txt", "a/b/c.txt", "./file.txt", "a/../b.txt"}
	for _, c := range cases {
		abs, err := Resolve(root, c)
		if err != nil {
			t.Errorf("Resolve(%q) failed: %v", c, err)
			continue
		}
		rootAbs, _ := filepath.Abs(root)
		if abs != rootAbs && len(abs) <= len(rootAbs) {
			t.Errorf("Resolve(%q) = %q, expected path under %q", c, abs, rootAbs)
		}
	}
}

func TestResolve_RejectsSymlinkEscape(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	secretPath := filepath.Join(outside, "secret.txt")
	if err := os.WriteFile(secretPath, []byte("top secret"), 0644); err != nil {
		t.Fatal(err)
	}

	linkPath := filepath.Join(root, "escape-link")
	if err := os.Symlink(outside, linkPath); err != nil {
		t.Fatal(err)
	}

	_, err := Resolve(root, "escape-link/secret.txt")
	if err == nil {
		t.Fatal("Resolve followed a symlink outside the server root; want ErrPathEscapesRoot")
	}
}

func TestDelete_RefusesRoot(t *testing.T) {
	root := t.TempDir()
	for _, p := range []string{"", ".", "/"} {
		if err := Delete(root, p); err == nil {
			t.Errorf("Delete(%q) succeeded, want refusal to delete server root", p)
		}
	}
}

func TestWriteThenReadRoundTrip(t *testing.T) {
	root := t.TempDir()
	content := "hello mcCore"
	encoded := "aGVsbG8gbWNDb3Jl" // base64("hello mcCore")
	if err := WriteFileBase64(root, "nested/dir/file.txt", encoded); err != nil {
		t.Fatalf("WriteFileBase64 failed: %v", err)
	}
	got, err := ReadFileBase64(root, "nested/dir/file.txt")
	if err != nil {
		t.Fatalf("ReadFileBase64 failed: %v", err)
	}
	if got != encoded {
		t.Errorf("round trip mismatch: got %q want %q", got, encoded)
	}
	_ = content
}

func TestList_OrdersDirectoriesFirst(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "b.txt"), []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(root, "a-dir"), 0755); err != nil {
		t.Fatal(err)
	}
	entries, err := List(root, "")
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	if len(entries) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(entries))
	}
	if !entries[0].IsDir {
		t.Errorf("expected directory first, got %+v", entries[0])
	}
}
