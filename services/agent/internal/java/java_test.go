package java

import (
	"testing"

	"github.com/cometa-mccore/mccore/services/agent/internal/sysinfo"
)

func TestSelectorForMinecraftVersion(t *testing.T) {
	cases := []struct {
		version string
		want    string
	}{
		{"1.7.10", "8"},
		{"1.16.5", "8"},
		{"1.17", "17"},
		{"1.17.1", "17"},
		{"1.18.2", "17"},
		{"1.19.4", "17"},
		{"1.20.4", "17"},
		{"1.20.5", "21"},
		{"1.20.6", "21"},
		{"1.21.4", "21"},
		// New non-"1.x" versioning scheme (observed live: PaperMC's startup
		// log reports "Minecraft 26.1 and newer requires ... Java 25").
		// This Agent has no verified per-version table for it, so anything
		// on the new scheme falls back to newestKnownLTS.
		{"26.1", newestKnownLTS},
		{"26.2", newestKnownLTS},
		{"27.0", newestKnownLTS},
		{"1", newestKnownLTS},
		{"garbage", newestKnownLTS},
	}
	for _, c := range cases {
		if got := SelectorForMinecraftVersion(c.version); got != c.want {
			t.Errorf("SelectorForMinecraftVersion(%q) = %q, want %q", c.version, got, c.want)
		}
	}
}

func TestResolveExactMatch(t *testing.T) {
	installs := []sysinfo.JavaInstallation{
		{Version: "17.0.9", Path: "/usr/lib/jvm/17/bin/java"},
		{Version: "21.0.4", Path: "/usr/lib/jvm/21/bin/java"},
	}
	got, err := NewResolver(installs).Resolve("21")
	if err != nil {
		t.Fatalf("Resolve(21) error: %v", err)
	}
	if got.Path != "/usr/lib/jvm/21/bin/java" {
		t.Errorf("Resolve(21).Path = %q, want the exact Java 21 install", got.Path)
	}
}

func TestResolveFallsBackToSmallestNewer(t *testing.T) {
	installs := []sysinfo.JavaInstallation{
		{Version: "17.0.9", Path: "/usr/lib/jvm/17/bin/java"},
		{Version: "25.0.1", Path: "/usr/lib/jvm/25/bin/java"},
	}
	// No Java 21 installed; 25 is the smallest newer runtime, so a server
	// that needs 21 should be bumped up to 25 rather than down to 17.
	got, err := NewResolver(installs).Resolve("21")
	if err != nil {
		t.Fatalf("Resolve(21) error: %v", err)
	}
	if got.Path != "/usr/lib/jvm/25/bin/java" {
		t.Errorf("Resolve(21).Path = %q, want the newer Java 25 install", got.Path)
	}
}

func TestResolveNoSatisfyingRuntime(t *testing.T) {
	installs := []sysinfo.JavaInstallation{{Version: "17.0.9", Path: "/usr/lib/jvm/17/bin/java"}}
	if _, err := NewResolver(installs).Resolve("21"); err == nil {
		t.Fatal("Resolve(21) with only Java 17 installed: want an error, got nil")
	}
}
