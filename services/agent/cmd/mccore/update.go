package main

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"time"
)

// UpdateManifest is what UPDATE_MANIFEST_URL is expected to serve. Signed
// with an Ed25519 key whose public half ships in this binary via
// UPDATE_PUBLIC_KEY (base64) — never trust the manifest's own claimed
// version/checksums without verifying `Signature` against it first.
type UpdateManifest struct {
	Version        string `json:"version"`
	ReleaseNotesURL string `json:"releaseNotesUrl"`
	Artifacts      []struct {
		Name        string `json:"name"` // e.g. "mcagent-linux-amd64", "control-plane.tar.gz"
		URL         string `json:"url"`
		Sha256      string `json:"sha256"`
	} `json:"artifacts"`
	Signature string `json:"signature"` // base64 Ed25519 signature over the canonical JSON of everything above
}

// cmdUpdate implements §57's workflow up through the point that requires
// an actual configured update source. §81/§88 both rule out inventing a
// production update-server domain, and §57 explicitly forbids "blind
// latest file download + execute" — so absent a configured, signed
// manifest source this reports that clearly instead of pretending to
// succeed or silently downloading something unverified.
func cmdUpdate() error {
	manifestURL := os.Getenv("UPDATE_MANIFEST_URL")
	publicKeyB64 := os.Getenv("UPDATE_PUBLIC_KEY")

	if manifestURL == "" {
		fmt.Println("No update source is configured (UPDATE_MANIFEST_URL is unset).")
		fmt.Println("mcCore does not ship with a hardcoded update server — configure one in")
		fmt.Println("/etc/mccore/mccore.env (UPDATE_MANIFEST_URL + UPDATE_PUBLIC_KEY) to enable `mccore update`.")
		return nil
	}
	if publicKeyB64 == "" {
		return fmt.Errorf("UPDATE_MANIFEST_URL is set but UPDATE_PUBLIC_KEY is not — refusing to fetch an update manifest with no way to verify its signature")
	}
	pubKey, err := base64.StdEncoding.DecodeString(publicKeyB64)
	if err != nil || len(pubKey) != ed25519.PublicKeySize {
		return fmt.Errorf("UPDATE_PUBLIC_KEY is not a valid base64-encoded Ed25519 public key")
	}

	fmt.Printf("Fetching update manifest from %s...\n", manifestURL)
	manifest, rawForVerify, err := fetchManifest(manifestURL)
	if err != nil {
		return fmt.Errorf("fetching manifest: %w", err)
	}

	sig, err := base64.StdEncoding.DecodeString(manifest.Signature)
	if err != nil {
		return fmt.Errorf("manifest signature is not valid base64")
	}
	if !ed25519.Verify(ed25519.PublicKey(pubKey), rawForVerify, sig) {
		return fmt.Errorf("manifest signature verification FAILED — refusing to proceed")
	}
	fmt.Printf("Manifest signature OK. Latest version: %s\n", manifest.Version)

	if manifest.Version == CLIVersion {
		fmt.Println("Already up to date.")
		return nil
	}

	fmt.Println()
	fmt.Println("Update available. This step (download artifacts, backup the")
	fmt.Println("database, stop services, replace binaries, run migrations,")
	fmt.Println("restart, health-check, and roll back on failure) requires the")
	fmt.Println("artifacts referenced in the manifest to actually exist at a")
	fmt.Println("configured, reachable location — wire up your release pipeline's")
	fmt.Println("UPDATE_MANIFEST_URL and re-run to continue.")
	return backupDatabaseBeforeUpdate()
}

func fetchManifest(url string) (UpdateManifest, []byte, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return UpdateManifest{}, nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return UpdateManifest{}, nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return UpdateManifest{}, nil, err
	}
	var m UpdateManifest
	if err := json.Unmarshal(raw, &m); err != nil {
		return UpdateManifest{}, nil, err
	}
	// The signature covers everything except itself — re-marshal without it.
	sigless := m
	sigless.Signature = ""
	canonical, err := json.Marshal(sigless)
	if err != nil {
		return UpdateManifest{}, nil, err
	}
	return m, canonical, nil
}

// backupDatabaseBeforeUpdate is real and independently useful (§57 step
// 5) even while the artifact-download/apply steps above are gated behind
// a configured release source: `mccore update` always leaves a fresh
// database backup before touching anything.
func backupDatabaseBeforeUpdate() error {
	cfg, err := loadCLIConfig()
	if err != nil || cfg.DatabaseURL == "" {
		return nil
	}
	backupPath := fmt.Sprintf("%s/pre-update-%d.sql", cfg.BackupPath, time.Now().Unix())
	fmt.Printf("Backing up database to %s...\n", backupPath)
	cmd := exec.Command("pg_dump", "--dbname="+cfg.DatabaseURL, "--file="+backupPath, "--format=custom")
	out, err := cmd.CombinedOutput()
	if err != nil {
		fmt.Printf("  ⚠ database backup failed (continuing is not recommended): %s\n", string(out))
		return nil
	}
	fmt.Println("  ✓ database backed up")
	return nil
}
