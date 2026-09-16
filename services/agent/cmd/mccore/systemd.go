package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

// unitNames is the complete, fixed allowlist of systemd units this CLI
// will ever reference — every call site below validates against this map
// before building an exec.Command, so a `--unit=` flag value can never
// reach systemctl as anything other than one of these exact strings
// (§25's "no shell string concatenation" applies here too: os/exec with a
// discrete argv, never a shell, and the argument itself is allowlisted,
// not just shell-escaped).
var unitNames = map[string]string{
	"control-plane": "mccore-control.service",
	"agent":         "mccore-agent.service",
	"web":           "mccore-web.service",
}

func resolveUnit(key string) (string, error) {
	unit, ok := unitNames[key]
	if !ok {
		return "", fmt.Errorf("unknown unit %q (expected one of: control-plane, agent, web)", key)
	}
	return unit, nil
}

func systemctl(ctx context.Context, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "systemctl", args...)
	out, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

func isActive(unit string) (active bool, output string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	out, err := systemctl(ctx, "is-active", unit)
	return err == nil && out == "active", out
}

func restartUnit(unit string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	out, err := systemctl(ctx, "restart", unit)
	if err != nil {
		return fmt.Errorf("restarting %s: %s: %w", unit, out, err)
	}
	return nil
}

func journalctlTail(unit string, lines int, follow bool) error {
	args := []string{"-u", unit, "-n", fmt.Sprintf("%d", lines)}
	if follow {
		args = append(args, "-f")
	}
	cmd := exec.Command("journalctl", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}
