// Package pluginmgr installs/removes plugin jars (§35). The Control Plane
// has already resolved the concrete download URL + hash against the
// provider's API (see apps/control-plane/src/modules/plugins) — this
// package's job is just the safe download-and-place, with its own
// independent host allowlist as defense in depth (the Agent never trusts
// "the Control Plane already checked" as its only line of defense).
package pluginmgr

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/cometa-mccore/mccore/services/agent/internal/fsops"
	"github.com/cometa-mccore/mccore/services/agent/internal/netdl"
)

var allowedPluginHosts = map[string]bool{
	"cdn.modrinth.com": true,
}

func Install(ctx context.Context, serverDir, downloadURL, expectedSha512, targetFileName string) error {
	if err := validateFileName(targetFileName); err != nil {
		return err
	}
	pluginsDir := filepath.Join(serverDir, "plugins")
	if err := os.MkdirAll(pluginsDir, 0755); err != nil {
		return fmt.Errorf("creating plugins directory: %w", err)
	}
	dest, err := fsops.Resolve(serverDir, filepath.ToSlash(filepath.Join("plugins", targetFileName)))
	if err != nil {
		return err
	}

	// netdl.Expected has no sha512 field (Vanilla/Paper/Purpur never use
	// it) — Modrinth's sha512 is verified separately here rather than
	// growing netdl's Expected struct for a single caller.
	if err := netdl.Download(ctx, downloadURL, dest, netdl.Options{AllowedHosts: allowedPluginHosts}); err != nil {
		return err
	}
	if expectedSha512 != "" {
		if err := verifySha512(dest, expectedSha512); err != nil {
			os.Remove(dest)
			return err
		}
	}
	return nil
}

func Delete(serverDir, fileName string) error {
	if err := validateFileName(fileName); err != nil {
		return err
	}
	target, err := fsops.Resolve(serverDir, filepath.ToSlash(filepath.Join("plugins", fileName)))
	if err != nil {
		return err
	}
	if err := os.Remove(target); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("removing plugin: %w", err)
	}
	return nil
}

// validateFileName rejects anything that isn't a bare filename — plugin
// file names come from a provider API response via the Control Plane, but
// this Agent still refuses to let one smuggle a path (e.g.
// "../../server.jar") through what's supposed to be a plain jar name.
func validateFileName(name string) error {
	if name == "" || name != filepath.Base(name) || filepath.Ext(name) != ".jar" {
		return fmt.Errorf("invalid plugin file name %q", name)
	}
	return nil
}
