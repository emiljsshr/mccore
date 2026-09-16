package software

import (
	"context"
	"fmt"
)

// purpurProvider talks to api.purpurmc.org/v2 — verified live; see
// docs/architecture.md.
type purpurProvider struct{}

const purpurBaseURL = "https://api.purpurmc.org/v2/purpur"

func (p *purpurProvider) Slug() string { return "purpur" }

type purpurProjectResponse struct {
	Versions []string `json:"versions"`
}

func (p *purpurProvider) ResolveVersions(ctx context.Context) ([]string, error) {
	var resp purpurProjectResponse
	if err := getJSON(ctx, purpurBaseURL, &resp); err != nil {
		return nil, err
	}
	return resp.Versions, nil
}

type purpurVersionResponse struct {
	Builds struct {
		Latest string   `json:"latest"`
		All    []string `json:"all"`
	} `json:"builds"`
}

type purpurBuildResponse struct {
	Version string `json:"version"`
	Build   string `json:"build"`
	Result  string `json:"result"`
	MD5     string `json:"md5"`
}

func (p *purpurProvider) ResolveBuild(ctx context.Context, version, build string) (ResolvedBuild, error) {
	if build == "" {
		var vr purpurVersionResponse
		if err := getJSON(ctx, fmt.Sprintf("%s/%s", purpurBaseURL, version), &vr); err != nil {
			return ResolvedBuild{}, err
		}
		if vr.Builds.Latest == "" {
			return ResolvedBuild{}, fmt.Errorf("no builds found for purpur %s", version)
		}
		build = vr.Builds.Latest
	}

	var br purpurBuildResponse
	if err := getJSON(ctx, fmt.Sprintf("%s/%s/%s", purpurBaseURL, version, build), &br); err != nil {
		return ResolvedBuild{}, err
	}
	if br.Result != "SUCCESS" {
		return ResolvedBuild{}, fmt.Errorf("purpur %s build %s did not build successfully (result=%s)", version, build, br.Result)
	}

	return ResolvedBuild{
		Version: version,
		Build:   build,
		// Purpur's download endpoint is a redirect-free direct stream, no
		// separate "resolve" step needed — this is the documented pattern.
		DownloadURL: fmt.Sprintf("%s/%s/%s/download", purpurBaseURL, version, build),
		// Purpur's API only publishes MD5 (no sha256) — download.go
		// verifies against whichever of Sha256/MD5 is non-empty.
		MD5:      br.MD5,
		FileName: fmt.Sprintf("purpur-%s-%s.jar", version, build),
	}, nil
}
