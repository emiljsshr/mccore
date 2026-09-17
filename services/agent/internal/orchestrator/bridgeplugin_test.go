package orchestrator

import (
	"os"
	"path/filepath"
	"testing"
)

func TestInstallBridgePluginSkipsNonBukkitSoftware(t *testing.T) {
	dir := t.TempDir()
	for _, software := range []string{"vanilla", "velocity"} {
		if err := installBridgePlugin(software, dir); err != nil {
			t.Fatalf("installBridgePlugin(%q): %v", software, err)
		}
		if _, err := os.Stat(filepath.Join(dir, "plugins", bridgePluginFileName)); !os.IsNotExist(err) {
			t.Errorf("installBridgePlugin(%q) installed the plugin, want it skipped for non-Bukkit software", software)
		}
	}
}

func TestInstallBridgePluginNoOpWhenBundleMissing(t *testing.T) {
	// In this test binary's own directory, mccore-bridge.jar doesn't exist
	// (it's only present in a real release build) — installBridgePlugin
	// must treat that as "feature unavailable", not a hard failure that
	// would abort an otherwise-successful install/configure.
	dir := t.TempDir()
	if err := installBridgePlugin("paper", dir); err != nil {
		t.Fatalf("installBridgePlugin with no bundled jar should not error, got: %v", err)
	}
}

func TestInstallBridgePluginFromCopiesJar(t *testing.T) {
	work := t.TempDir()
	src := filepath.Join(work, bridgePluginFileName)
	want := []byte("fake-jar-bytes")
	if err := os.WriteFile(src, want, 0644); err != nil {
		t.Fatal(err)
	}
	serverDir := filepath.Join(work, "server")
	if err := installBridgePluginFrom(src, serverDir); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(filepath.Join(serverDir, "plugins", bridgePluginFileName))
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != string(want) {
		t.Errorf("installed jar contents = %q, want %q", got, want)
	}
}
