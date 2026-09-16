// Package config loads the Agent's configuration from an env-style file
// (production: /etc/mccore/mccore.env, mode 600, owner mccore — §52) plus
// environment variable overrides. No secrets are ever logged from here.
package config

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	NodeName          string
	ControlPlaneURL   string // e.g. https://panel.example.com (browser-facing origin; agent hits /api/v1 + /ws/agent through it)
	EnrollmentToken   string // only used on first run, then discarded
	StoragePath       string // /var/lib/mccore/servers
	BackupPath        string // /var/lib/mccore/backups
	AgentStatePath    string // /var/lib/mccore/agent
	DatabaseURL       string // used only by `mccore admin` local commands, never by the daemon's runtime path
	HealthListenAddr  string // 127.0.0.1:PORT for local health checks (§50)
	LogLevel          string
	DiskCriticalRatio float64 // §63 — block risky operations above this disk usage ratio
}

func defaults() Config {
	return Config{
		NodeName:          "",
		ControlPlaneURL:   "http://127.0.0.1:3000",
		StoragePath:       "/var/lib/mccore/servers",
		BackupPath:        "/var/lib/mccore/backups",
		AgentStatePath:    "/var/lib/mccore/agent",
		HealthListenAddr:  "127.0.0.1:8085",
		LogLevel:          "info",
		DiskCriticalRatio: 0.95,
	}
}

// Load reads KEY=VALUE pairs from path (if it exists — a missing file is
// not an error, since local dev relies purely on environment variables),
// then applies any MCCORE_* environment variable overrides.
func Load(path string) (Config, error) {
	cfg := defaults()
	values := map[string]string{}

	if path != "" {
		if f, err := os.Open(path); err == nil {
			defer f.Close()
			scanner := bufio.NewScanner(f)
			for scanner.Scan() {
				line := strings.TrimSpace(scanner.Text())
				if line == "" || strings.HasPrefix(line, "#") {
					continue
				}
				eq := strings.IndexByte(line, '=')
				if eq < 0 {
					continue
				}
				key := strings.TrimSpace(line[:eq])
				val := strings.TrimSpace(line[eq+1:])
				val = strings.Trim(val, `"'`)
				values[key] = val
			}
			if err := scanner.Err(); err != nil {
				return cfg, fmt.Errorf("reading config file: %w", err)
			}
		} else if !os.IsNotExist(err) {
			return cfg, fmt.Errorf("opening config file: %w", err)
		}
	}

	get := func(key, fallback string) string {
		if v, ok := os.LookupEnv(key); ok && v != "" {
			return v
		}
		if v, ok := values[key]; ok && v != "" {
			return v
		}
		return fallback
	}

	cfg.NodeName = get("AGENT_NODE_NAME", cfg.NodeName)
	cfg.ControlPlaneURL = get("CONTROL_PLANE_URL", cfg.ControlPlaneURL)
	cfg.EnrollmentToken = get("AGENT_ENROLLMENT_TOKEN", "")
	cfg.StoragePath = get("STORAGE_PATH", cfg.StoragePath)
	cfg.BackupPath = get("BACKUP_PATH", cfg.BackupPath)
	cfg.AgentStatePath = get("AGENT_STATE_PATH", cfg.AgentStatePath)
	cfg.DatabaseURL = get("DATABASE_URL", "")
	cfg.HealthListenAddr = get("AGENT_HEALTH_ADDR", cfg.HealthListenAddr)
	cfg.LogLevel = get("LOG_LEVEL", cfg.LogLevel)

	if v := get("DISK_CRITICAL_RATIO", ""); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			cfg.DiskCriticalRatio = f
		}
	}

	return cfg, nil
}
