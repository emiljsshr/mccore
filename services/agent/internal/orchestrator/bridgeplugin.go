package orchestrator

import (
	"fmt"
	"os"
	"path/filepath"
)

const bridgePluginFileName = "mccore-bridge.jar"

// bridgePluginSourcePath locates the Agent's own bundled copy of the
// mcCore Bridge plugin (services/bridge-plugin), shipped as
// bin/mccore-bridge.jar alongside the mcagent binary itself in the release
// archive (see scripts/build-release.sh) — resolved relative to the
// running binary rather than a config value, so there's nothing new for
// the installer to wire through.
func bridgePluginSourcePath() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("locating mcagent binary: %w", err)
	}
	return filepath.Join(filepath.Dir(exe), bridgePluginFileName), nil
}

// installBridgePlugin drops the Agent's bundled mcCore Bridge plugin into a
// Bukkit-API server's plugins/ directory — Paper and Purpur only; Vanilla
// has no plugin loader and Velocity uses a different plugin format
// entirely. Always overwrites (same "managed" rule as writeServerIcon):
// every install/configure call ships whatever version of the plugin this
// Agent currently bundles, so upgrading the Agent upgrades the plugin too.
func installBridgePlugin(software, serverDir string) error {
	if software != "paper" && software != "purpur" {
		return nil
	}
	src, err := bridgePluginSourcePath()
	if err != nil {
		return err
	}
	return installBridgePluginFrom(src, serverDir)
}

// installBridgePluginFrom does the actual copy, taking the bundled jar's
// path explicitly so tests can point it at a fixture instead of the real
// mcagent binary's directory.
func installBridgePluginFrom(src, serverDir string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		if os.IsNotExist(err) {
			// Not fatal: an older release built before the Bridge existed,
			// or a dev build that skipped it. Advancement/inventory
			// features just won't work for this server; everything else
			// (start/stop, console, files, backups) is unaffected.
			return nil
		}
		return fmt.Errorf("reading bundled bridge plugin: %w", err)
	}
	pluginsDir := filepath.Join(serverDir, "plugins")
	if err := os.MkdirAll(pluginsDir, 0755); err != nil {
		return fmt.Errorf("creating plugins directory: %w", err)
	}
	dest := filepath.Join(pluginsDir, bridgePluginFileName)
	tmp := dest + ".tmp"
	if err := os.WriteFile(tmp, data, 0644); err != nil {
		return fmt.Errorf("writing bridge plugin: %w", err)
	}
	// Atomic replace: a server that's mid-startup and already scanning
	// plugins/ should never see a half-written jar.
	if err := os.Rename(tmp, dest); err != nil {
		return fmt.Errorf("installing bridge plugin: %w", err)
	}
	return nil
}
