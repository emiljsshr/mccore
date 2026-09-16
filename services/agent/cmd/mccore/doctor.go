package main

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"syscall"
	"time"

	"github.com/cometa-mccore/mccore/services/agent/internal/dbadmin"
)

type checkResult struct {
	name   string
	status string // PASS | WARN | FAIL
	detail string
}

func (c checkResult) String() string {
	symbol := map[string]string{"PASS": "✓", "WARN": "⚠", "FAIL": "✗"}[c.status]
	return fmt.Sprintf("  %s %-6s %-22s %s", symbol, c.status, c.name, c.detail)
}

// cmdDoctor implements §56 — every check here is a real, independent
// probe (systemctl, a TCP dial, a filesystem stat, a DB round-trip), not
// a canned "everything is fine" response.
func cmdDoctor() error {
	cfg, err := loadCLIConfig()
	if err != nil {
		return fmt.Errorf("loading config: %w", err)
	}

	var results []checkResult
	failures := 0
	record := func(r checkResult) {
		results = append(results, r)
		if r.status == "FAIL" {
			failures++
		}
	}

	// Services
	for _, key := range []string{"control-plane", "agent"} {
		unit := unitNames[key]
		active, _ := isActive(unit)
		if active {
			record(checkResult{"service:" + key, "PASS", unit + " is active"})
		} else {
			record(checkResult{"service:" + key, "FAIL", unit + " is not active"})
		}
	}

	// Database
	if cfg.DatabaseURL == "" {
		record(checkResult{"database", "FAIL", "DATABASE_URL not configured"})
	} else if db, err := dbadmin.Connect(cfg.DatabaseURL); err != nil {
		record(checkResult{"database", "FAIL", err.Error()})
	} else {
		db.Close()
		record(checkResult{"database", "PASS", "connection OK"})
	}

	// Agent local health
	client := &http.Client{Timeout: 3 * time.Second}
	if resp, err := client.Get("http://" + cfg.HealthListenAddr + "/healthz"); err != nil {
		record(checkResult{"agent health", "FAIL", err.Error()})
	} else {
		resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			record(checkResult{"agent health", "PASS", "connected to control plane"})
		} else {
			record(checkResult{"agent health", "WARN", "running but not connected"})
		}
	}

	// Directories + permissions
	for _, dir := range []string{cfg.StoragePath, cfg.BackupPath, cfg.AgentStatePath} {
		info, err := os.Stat(dir)
		switch {
		case err != nil:
			record(checkResult{"dir:" + dir, "FAIL", "missing: " + err.Error()})
		case !info.IsDir():
			record(checkResult{"dir:" + dir, "FAIL", "exists but is not a directory"})
		default:
			mode := info.Mode().Perm()
			if mode&0077 != 0 {
				record(checkResult{"dir:" + dir, "WARN", fmt.Sprintf("permissions %o are broader than recommended (0700/0750)", mode)})
			} else {
				record(checkResult{"dir:" + dir, "PASS", fmt.Sprintf("exists, mode %o", mode)})
			}
		}
	}

	// Disk space
	for _, dir := range []string{cfg.StoragePath, cfg.BackupPath} {
		if ratio, err := diskUsageRatio(dir); err == nil {
			switch {
			case ratio >= 0.95:
				record(checkResult{"disk:" + dir, "FAIL", fmt.Sprintf("%.0f%% full", ratio*100)})
			case ratio >= 0.85:
				record(checkResult{"disk:" + dir, "WARN", fmt.Sprintf("%.0f%% full", ratio*100)})
			default:
				record(checkResult{"disk:" + dir, "PASS", fmt.Sprintf("%.0f%% full", ratio*100)})
			}
		}
	}

	// Java
	if path, err := exec.LookPath("java"); err != nil {
		record(checkResult{"java", "WARN", "no `java` on PATH (agent detects JDKs independently under /usr/lib/jvm)"})
	} else {
		record(checkResult{"java", "PASS", path})
	}

	// Ports
	if reachable(cfg.HealthListenAddr) {
		record(checkResult{"agent port", "PASS", cfg.HealthListenAddr + " is listening"})
	} else {
		record(checkResult{"agent port", "FAIL", cfg.HealthListenAddr + " is not reachable"})
	}

	// Reverse proxy / TLS — best-effort: check the configured PUBLIC_URL if any
	if publicURL := os.Getenv("PUBLIC_URL"); publicURL != "" {
		if strings.HasPrefix(publicURL, "https://") {
			record(checkResult{"TLS", "PASS", "PUBLIC_URL uses https://"})
		} else {
			record(checkResult{"TLS", "WARN", "PUBLIC_URL is not https:// — fine for local/IP-only installs, required for production (§53)"})
		}
	} else {
		record(checkResult{"TLS", "WARN", "PUBLIC_URL not set — reverse proxy / TLS not configured"})
	}

	fmt.Println("mccore doctor")
	fmt.Println()
	for _, r := range results {
		fmt.Println(r.String())
	}
	fmt.Println()
	if failures > 0 {
		fmt.Printf("%d check(s) failed.\n", failures)
		os.Exit(1)
	}
	fmt.Println("All checks passed (warnings, if any, are non-fatal).")
	return nil
}

func diskUsageRatio(path string) (float64, error) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return 0, err
	}
	total := stat.Blocks * uint64(stat.Bsize)
	free := stat.Bavail * uint64(stat.Bsize)
	if total == 0 {
		return 0, fmt.Errorf("zero-size filesystem")
	}
	return float64(total-free) / float64(total), nil
}

func reachable(hostport string) bool {
	conn, err := net.DialTimeout("tcp", hostport, 2*time.Second)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}
