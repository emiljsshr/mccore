// Package netdl is the one place in the Agent that streams a file down
// from the internet to disk. Both internal/software (server jars) and
// internal/pluginmgr (plugin jars) call this with their own host
// allowlist — see docs/architecture.md §"Download Security" (§67).
package netdl

import (
	"context"
	"crypto/md5" //nolint:gosec // integrity check only when a provider publishes no stronger hash; never the sole trust boundary (HTTPS + host allowlist are)
	"crypto/sha1"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"hash"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"
)

type Expected struct {
	Sha256 string
	Sha1   string
	MD5    string
}

type Options struct {
	AllowedHosts map[string]bool
	Expected     Expected
	Timeout      time.Duration // 0 = default
	MaxBytes     int64         // 0 = default
}

const (
	defaultTimeout  = 5 * time.Minute
	defaultMaxBytes = 512 * 1024 * 1024 // generous headroom over any real server/plugin jar
	maxRedirects    = 3
)

// Download streams `downloadURL` to `destPath` (via a temp file + atomic
// rename), verifying it against whichever Expected hash is non-empty
// (sha256 preferred, then sha1, then md5) as it streams — never buffering
// the whole file in memory (§34).
func Download(ctx context.Context, downloadURL, destPath string, opts Options) error {
	parsed, err := url.Parse(downloadURL)
	if err != nil {
		return fmt.Errorf("invalid download URL: %w", err)
	}
	if parsed.Scheme != "https" {
		return fmt.Errorf("refusing non-HTTPS download URL: %s", downloadURL)
	}
	if !opts.AllowedHosts[parsed.Hostname()] {
		return fmt.Errorf("refusing download from unrecognized host %q (not in allowlist)", parsed.Hostname())
	}

	timeout := opts.Timeout
	if timeout == 0 {
		timeout = defaultTimeout
	}
	maxBytes := opts.MaxBytes
	if maxBytes == 0 {
		maxBytes = defaultMaxBytes
	}

	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= maxRedirects {
				return fmt.Errorf("too many redirects")
			}
			if !opts.AllowedHosts[req.URL.Hostname()] {
				return fmt.Errorf("redirect to unrecognized host %q rejected", req.URL.Hostname())
			}
			return nil
		},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, downloadURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "mcCore-agent/0.1 (+https://github.com/cometa-mccore/mccore)")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("downloading %s: %w", downloadURL, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%s returned HTTP %d", downloadURL, resp.StatusCode)
	}
	if resp.ContentLength > maxBytes {
		return fmt.Errorf("download of %d bytes exceeds the %d byte limit", resp.ContentLength, maxBytes)
	}

	tmp := destPath + ".downloading"
	out, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return fmt.Errorf("creating destination file: %w", err)
	}

	var sha256Hasher, sha1Hasher, md5Hasher hash.Hash
	writers := []io.Writer{out}
	if opts.Expected.Sha256 != "" {
		sha256Hasher = sha256.New()
		writers = append(writers, sha256Hasher)
	}
	if opts.Expected.Sha1 != "" {
		sha1Hasher = sha1.New()
		writers = append(writers, sha1Hasher)
	}
	if opts.Expected.MD5 != "" {
		md5Hasher = md5.New() //nolint:gosec
		writers = append(writers, md5Hasher)
	}
	multi := io.MultiWriter(writers...)

	limited := io.LimitReader(resp.Body, maxBytes+1)
	written, copyErr := io.Copy(multi, limited)
	closeErr := out.Close()
	if copyErr != nil {
		os.Remove(tmp)
		return fmt.Errorf("writing download: %w", copyErr)
	}
	if closeErr != nil {
		os.Remove(tmp)
		return fmt.Errorf("closing download file: %w", closeErr)
	}
	if written > maxBytes {
		os.Remove(tmp)
		return fmt.Errorf("download exceeded the %d byte limit", maxBytes)
	}

	if err := verify(sha256Hasher, opts.Expected.Sha256, "sha256"); err != nil {
		os.Remove(tmp)
		return err
	}
	if err := verify(sha1Hasher, opts.Expected.Sha1, "sha1"); err != nil {
		os.Remove(tmp)
		return err
	}
	if err := verify(md5Hasher, opts.Expected.MD5, "md5"); err != nil {
		os.Remove(tmp)
		return err
	}

	if err := os.Rename(tmp, destPath); err != nil {
		os.Remove(tmp)
		return fmt.Errorf("finalizing download: %w", err)
	}
	return nil
}

func verify(h hash.Hash, expected, algo string) error {
	if h == nil {
		return nil
	}
	got := hex.EncodeToString(h.Sum(nil))
	if got != expected {
		return fmt.Errorf("%s mismatch: expected %s, got %s", algo, expected, got)
	}
	return nil
}
