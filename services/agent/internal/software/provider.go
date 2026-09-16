// Package software implements the ServerSoftwareProvider abstraction
// (§21/§35): one small interface, one implementation per Minecraft server
// software, so adding a new software is additive rather than a rewrite of
// the install pipeline. All four implemented providers (Paper, Purpur,
// Vanilla, Velocity) were verified against their live, real APIs while
// building this (see docs/architecture.md for the exact endpoints and
// response shapes) — none of this is mocked.
package software

import (
	"context"
	"fmt"
)

type ResolvedBuild struct {
	Version     string
	Build       string // build id/number; empty for software with no build concept (Vanilla)
	DownloadURL string
	Sha1        string
	Sha256      string
	MD5         string // set only by providers (Purpur) that don't publish a SHA — see download.go
	SizeBytes   int64
	FileName    string
}

// Provider resolves versions/builds and hands back a verified download
// target — it never performs the download itself (see download.go), and
// it never accepts a caller-supplied base URL: every implementation talks
// to exactly one hardcoded upstream host.
type Provider interface {
	Slug() string
	ResolveVersions(ctx context.Context) ([]string, error)
	// ResolveBuild returns the concrete downloadable artifact for a
	// version. `build` == "" means "the latest/most recent stable build".
	ResolveBuild(ctx context.Context, version, build string) (ResolvedBuild, error)
}

var ErrUnsupportedSoftware = fmt.Errorf("unsupported server software")

func GetProvider(softwareSlug string) (Provider, error) {
	switch softwareSlug {
	case "paper":
		return &fillProvider{project: "paper"}, nil
	case "velocity":
		return &fillProvider{project: "velocity"}, nil
	case "purpur":
		return &purpurProvider{}, nil
	case "vanilla":
		return &vanillaProvider{}, nil
	case "fabric", "forge", "neoforge":
		// §21 requires the *architecture* to be extensible to these, not
		// that every provider ships in this pass — the Provider interface
		// above is exactly what a follow-up implementation plugs into.
		// Returning a clear, typed error here (never a silent fake success)
		// is the honest thing to do until that lands.
		return nil, fmt.Errorf("%w: %q is not implemented yet (interface is ready — see docs/architecture.md)", ErrUnsupportedSoftware, softwareSlug)
	default:
		return nil, fmt.Errorf("%w: %q", ErrUnsupportedSoftware, softwareSlug)
	}
}
