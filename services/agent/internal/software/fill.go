package software

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"time"
)

// fillProvider covers every PaperMC-family project served from
// fill.papermc.io's v3 API (Paper and Velocity today; Folia would be the
// same shape if added later). Verified live against the real API — see
// docs/architecture.md.
type fillProvider struct {
	project string // "paper" | "velocity"
}

const fillBaseURL = "https://fill.papermc.io/v3"

func (p *fillProvider) Slug() string { return p.project }

type fillProjectResponse struct {
	Project struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"project"`
	Versions map[string][]string `json:"versions"`
}

func (p *fillProvider) ResolveVersions(ctx context.Context) ([]string, error) {
	var resp fillProjectResponse
	if err := getJSON(ctx, fmt.Sprintf("%s/projects/%s", fillBaseURL, p.project), &resp); err != nil {
		return nil, err
	}
	var all []string
	for _, group := range resp.Versions {
		all = append(all, group...)
	}
	sort.Strings(all)
	return all, nil
}

type fillBuild struct {
	ID        int       `json:"id"`
	Time      time.Time `json:"time"`
	Channel   string    `json:"channel"`
	Downloads map[string]struct {
		Name      string `json:"name"`
		Checksums struct {
			Sha256 string `json:"sha256"`
		} `json:"checksums"`
		Size int64  `json:"size"`
		URL  string `json:"url"`
	} `json:"downloads"`
}

func (p *fillProvider) ResolveBuild(ctx context.Context, version, build string) (ResolvedBuild, error) {
	var builds []fillBuild
	url := fmt.Sprintf("%s/projects/%s/versions/%s/builds", fillBaseURL, p.project, version)
	if err := getJSON(ctx, url, &builds); err != nil {
		return ResolvedBuild{}, err
	}
	if len(builds) == 0 {
		return ResolvedBuild{}, fmt.Errorf("no builds found for %s %s", p.project, version)
	}

	var chosen *fillBuild
	if build == "" {
		// Builds are returned newest-first in practice, but don't rely on
		// response ordering — pick the highest STABLE build id explicitly,
		// falling back to the highest build id of any channel if there is
		// no STABLE build for this version yet.
		bestStable, bestAny := -1, -1
		for i := range builds {
			if builds[i].ID > bestAny {
				bestAny = builds[i].ID
			}
			if builds[i].Channel == "STABLE" && builds[i].ID > bestStable {
				bestStable = builds[i].ID
			}
		}
		target := bestStable
		if target == -1 {
			target = bestAny
		}
		for i := range builds {
			if builds[i].ID == target {
				chosen = &builds[i]
				break
			}
		}
	} else {
		for i := range builds {
			if fmt.Sprintf("%d", builds[i].ID) == build {
				chosen = &builds[i]
				break
			}
		}
	}
	if chosen == nil {
		return ResolvedBuild{}, fmt.Errorf("build %q not found for %s %s", build, p.project, version)
	}

	dl, ok := chosen.Downloads["server:default"]
	if !ok {
		return ResolvedBuild{}, fmt.Errorf("build %d of %s %s has no server:default download", chosen.ID, p.project, version)
	}

	return ResolvedBuild{
		Version:     version,
		Build:       fmt.Sprintf("%d", chosen.ID),
		DownloadURL: dl.URL,
		Sha256:      dl.Checksums.Sha256,
		SizeBytes:   dl.Size,
		FileName:    dl.Name,
	}, nil
}

func getJSON(ctx context.Context, url string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "mcCore-agent/0.1 (+https://github.com/cometa-mccore/mccore)")
	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("requesting %s: %w", url, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%s returned HTTP %d", url, resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}
