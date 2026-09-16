package software

import (
	"context"
	"fmt"
)

// vanillaProvider talks to Mojang's piston-meta version manifest —
// verified live; see docs/architecture.md. Vanilla has no "build" concept,
// so ResolveBuild's `build` parameter is ignored (always the one official
// server.jar for that version).
type vanillaProvider struct{}

const versionManifestURL = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"

func (p *vanillaProvider) Slug() string { return "vanilla" }

type manifestResponse struct {
	Versions []struct {
		ID  string `json:"id"`
		URL string `json:"url"`
	} `json:"versions"`
}

func (p *vanillaProvider) ResolveVersions(ctx context.Context) ([]string, error) {
	var resp manifestResponse
	if err := getJSON(ctx, versionManifestURL, &resp); err != nil {
		return nil, err
	}
	out := make([]string, len(resp.Versions))
	for i, v := range resp.Versions {
		out[i] = v.ID
	}
	return out, nil
}

type versionMetadata struct {
	Downloads struct {
		Server struct {
			URL  string `json:"url"`
			Sha1 string `json:"sha1"`
			Size int64  `json:"size"`
		} `json:"server"`
	} `json:"downloads"`
}

func (p *vanillaProvider) ResolveBuild(ctx context.Context, version, _ string) (ResolvedBuild, error) {
	var manifest manifestResponse
	if err := getJSON(ctx, versionManifestURL, &manifest); err != nil {
		return ResolvedBuild{}, err
	}
	var versionURL string
	for _, v := range manifest.Versions {
		if v.ID == version {
			versionURL = v.URL
			break
		}
	}
	if versionURL == "" {
		return ResolvedBuild{}, fmt.Errorf("unknown vanilla version %q", version)
	}

	var meta versionMetadata
	if err := getJSON(ctx, versionURL, &meta); err != nil {
		return ResolvedBuild{}, err
	}
	if meta.Downloads.Server.URL == "" {
		return ResolvedBuild{}, fmt.Errorf("vanilla %s has no server download (client-only release?)", version)
	}

	return ResolvedBuild{
		Version:     version,
		Build:       "",
		DownloadURL: meta.Downloads.Server.URL,
		Sha1:        meta.Downloads.Server.Sha1,
		SizeBytes:   meta.Downloads.Server.Size,
		FileName:    "server.jar",
	}, nil
}
