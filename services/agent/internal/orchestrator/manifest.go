package orchestrator

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// manifest is the durable, on-disk (inside the server's own directory)
// record of how to launch it — jar file name, software family, and
// resource limits. Unlike the Agent's state.json (which only tracks the
// live PID for crash recovery, see internal/state), this survives
// reinstalls and is what `server.start`/`server.restart` read on every
// launch, including after an Agent restart, so the Agent never needs to
// ask the Control Plane "how do I start this server again?".
type manifest struct {
	Software        string `json:"software"`
	JarFileName     string `json:"jarFileName"`
	JavaPath        string `json:"javaPath"`
	MemoryMinMb     int    `json:"memoryMinMb"`
	MemoryMaxMb     int    `json:"memoryMaxMb"`
	CPULimitPercent int    `json:"cpuLimitPercent"`
	DiskLimitMb     int    `json:"diskLimitMb"`
}

func manifestPath(serverDir string) string {
	return filepath.Join(serverDir, ".mccore", "manifest.json")
}

func writeManifest(serverDir string, m manifest) error {
	if err := os.MkdirAll(filepath.Dir(manifestPath(serverDir)), 0700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(manifestPath(serverDir), data, 0600)
}

func readManifest(serverDir string) (manifest, error) {
	data, err := os.ReadFile(manifestPath(serverDir))
	if err != nil {
		return manifest{}, fmt.Errorf("reading server manifest (has it been installed?): %w", err)
	}
	var m manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return manifest{}, fmt.Errorf("parsing server manifest: %w", err)
	}
	return m, nil
}
