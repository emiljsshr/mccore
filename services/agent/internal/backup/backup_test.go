package backup

import (
	"archive/tar"
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/klauspost/compress/zstd"
)

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
}

func TestCreateAndRestore_RoundTrip(t *testing.T) {
	serverDir := t.TempDir()
	writeFile(t, filepath.Join(serverDir, "server.properties"), "motd=hi")
	writeFile(t, filepath.Join(serverDir, "world", "level.dat"), "fake-level-data")
	writeFile(t, filepath.Join(serverDir, "world", "region", "r.0.0.mca"), "fake-region")
	writeFile(t, filepath.Join(serverDir, "plugins", "Foo.jar"), "fake-jar")
	writeFile(t, filepath.Join(serverDir, "logs", "latest.log"), "should not be archived")

	backupPath := filepath.Join(t.TempDir(), "backup.tar.zst")
	result, err := Create(context.Background(), serverDir, backupPath, CreateOptions{
		IncludesWorlds: true, IncludesPlugins: true, IncludesConfig: true, Compression: "fast",
	}, nil)
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	if result.SizeBytes == 0 || result.Sha256 == "" {
		t.Fatalf("incomplete create result: %+v", result)
	}

	if err := VerifyChecksum(backupPath, result.Sha256); err != nil {
		t.Fatalf("VerifyChecksum failed on a backup we just wrote: %v", err)
	}
	if err := VerifyChecksum(backupPath, "0000000000000000000000000000000000000000000000000000000000000"); err == nil {
		t.Fatal("VerifyChecksum accepted a wrong checksum")
	}

	restoreTarget := filepath.Join(t.TempDir(), "restored-server")
	safety, err := Restore(context.Background(), backupPath, restoreTarget)
	if err != nil {
		t.Fatalf("Restore failed: %v", err)
	}
	if safety != "" {
		t.Errorf("expected no safety backup dir for a fresh restore target, got %q", safety)
	}

	if _, err := os.Stat(filepath.Join(restoreTarget, "server.properties")); err != nil {
		t.Errorf("server.properties missing after restore: %v", err)
	}
	if _, err := os.Stat(filepath.Join(restoreTarget, "world", "level.dat")); err != nil {
		t.Errorf("world/level.dat missing after restore: %v", err)
	}
	if _, err := os.Stat(filepath.Join(restoreTarget, "plugins", "Foo.jar")); err != nil {
		t.Errorf("plugins/Foo.jar missing after restore: %v", err)
	}
	if _, err := os.Stat(filepath.Join(restoreTarget, "logs")); err == nil {
		t.Error("logs/ should have been excluded from the backup")
	}
}

func TestCreate_RespectsIncludeFlags(t *testing.T) {
	serverDir := t.TempDir()
	writeFile(t, filepath.Join(serverDir, "server.properties"), "motd=hi")
	writeFile(t, filepath.Join(serverDir, "world", "level.dat"), "fake")
	writeFile(t, filepath.Join(serverDir, "plugins", "Foo.jar"), "fake")

	backupPath := filepath.Join(t.TempDir(), "backup.tar.zst")
	_, err := Create(context.Background(), serverDir, backupPath, CreateOptions{
		IncludesWorlds: false, IncludesPlugins: false, IncludesConfig: true, Compression: "none",
	}, nil)
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}

	restoreTarget := filepath.Join(t.TempDir(), "restored")
	if _, err := Restore(context.Background(), backupPath, restoreTarget); err != nil {
		t.Fatalf("Restore failed: %v", err)
	}
	if _, err := os.Stat(filepath.Join(restoreTarget, "server.properties")); err != nil {
		t.Error("config should have been included")
	}
	if _, err := os.Stat(filepath.Join(restoreTarget, "world")); err == nil {
		t.Error("world should have been excluded")
	}
	if _, err := os.Stat(filepath.Join(restoreTarget, "plugins")); err == nil {
		t.Error("plugins should have been excluded")
	}
}

// TestRestore_RejectsZipSlip builds a hand-crafted malicious tar.zst
// archive (not via Create, which would never produce one) with a path
// traversal entry, and confirms Restore refuses to extract it outside the
// target directory.
func TestRestore_RejectsZipSlip(t *testing.T) {
	maliciousPath := filepath.Join(t.TempDir(), "evil.tar.zst")
	f, err := os.Create(maliciousPath)
	if err != nil {
		t.Fatal(err)
	}
	zw, err := zstd.NewWriter(f)
	if err != nil {
		t.Fatal(err)
	}
	tw := tar.NewWriter(zw)
	content := []byte("pwned")
	if err := tw.WriteHeader(&tar.Header{Name: "../../etc/evil.txt", Mode: 0644, Size: int64(len(content))}); err != nil {
		t.Fatal(err)
	}
	if _, err := tw.Write(content); err != nil {
		t.Fatal(err)
	}
	tw.Close()
	zw.Close()
	f.Close()

	restoreTarget := filepath.Join(t.TempDir(), "restored")
	_, err = Restore(context.Background(), maliciousPath, restoreTarget)
	if err == nil {
		t.Fatal("Restore accepted a path-traversal archive entry; want an error")
	}

	// Confirm nothing was written outside the intended restore tree.
	outside := filepath.Join(filepath.Dir(filepath.Dir(restoreTarget)), "etc", "evil.txt")
	if _, statErr := os.Stat(outside); statErr == nil {
		t.Fatalf("zip-slip entry was written outside the restore target at %s", outside)
	}
}
