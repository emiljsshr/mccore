package software

import (
	"context"
	"net/http"
	"testing"
	"time"
)

// These hit the real upstream APIs (verified manually while building the
// providers — see docs/architecture.md). They're integration tests, not
// unit tests: skipped automatically if the sandbox/CI has no outbound
// network access, rather than failing the whole suite over connectivity.
func requireNetwork(t *testing.T) {
	t.Helper()
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")
	if err != nil {
		t.Skipf("no outbound network access in this environment: %v", err)
	}
	resp.Body.Close()
}

func TestVanillaProvider_ResolvesLatestRelease(t *testing.T) {
	requireNetwork(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	p := &vanillaProvider{}
	versions, err := p.ResolveVersions(ctx)
	if err != nil {
		t.Fatalf("ResolveVersions failed: %v", err)
	}
	if len(versions) == 0 {
		t.Fatal("expected at least one version")
	}

	build, err := p.ResolveBuild(ctx, versions[0], "")
	if err != nil {
		t.Fatalf("ResolveBuild(%s) failed: %v", versions[0], err)
	}
	if build.DownloadURL == "" || build.Sha1 == "" || build.SizeBytes == 0 {
		t.Fatalf("incomplete resolved build: %+v", build)
	}
}

func TestPaperProvider_ResolvesLatestBuild(t *testing.T) {
	requireNetwork(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	p := &fillProvider{project: "paper"}
	versions, err := p.ResolveVersions(ctx)
	if err != nil {
		t.Fatalf("ResolveVersions failed: %v", err)
	}
	if len(versions) == 0 {
		t.Fatal("expected at least one version")
	}

	// Versions aren't guaranteed to all have builds (very new/very old);
	// try a handful from the end of the sorted list before giving up.
	var lastErr error
	for i := len(versions) - 1; i >= 0 && i >= len(versions)-5; i-- {
		build, err := p.ResolveBuild(ctx, versions[i], "")
		if err == nil {
			if build.DownloadURL == "" || build.Sha256 == "" {
				t.Fatalf("incomplete resolved build: %+v", build)
			}
			return
		}
		lastErr = err
	}
	t.Fatalf("could not resolve a build for any recent Paper version: %v", lastErr)
}

func TestPurpurProvider_ResolvesLatestBuild(t *testing.T) {
	requireNetwork(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	p := &purpurProvider{}
	versions, err := p.ResolveVersions(ctx)
	if err != nil {
		t.Fatalf("ResolveVersions failed: %v", err)
	}
	if len(versions) == 0 {
		t.Fatal("expected at least one version")
	}

	build, err := p.ResolveBuild(ctx, versions[len(versions)-1], "")
	if err != nil {
		t.Fatalf("ResolveBuild failed: %v", err)
	}
	if build.DownloadURL == "" {
		t.Fatalf("incomplete resolved build: %+v", build)
	}
}
