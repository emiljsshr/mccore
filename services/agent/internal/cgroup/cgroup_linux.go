//go:build linux

package cgroup

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
)

// cgroupBase is the delegated cgroup the installer creates
// (installer/systemd/mccore-runtime.service — a Type=oneshot,
// RemainAfterExit=yes unit whose only job is to hold open a
// Delegate=cpu memory pids cgroup, owned by the mccore user) — never the
// Agent's own service cgroup. A dedicated delegated unit never holds a
// "real" process of its own (ExecStart=/bin/true), only the per-server
// child cgroups placed under it, so delegating it doesn't run into
// cgroup v2's "no internal process" rule the way delegating
// mccore-agent.service's own cgroup would (that one *does* hold the
// Agent's own PID). See docs/architecture.md.
const cgroupBase = "/sys/fs/cgroup/system.slice/mccore-runtime.service"

type linuxController struct{}

func NewController() Controller { return &linuxController{} }

func (c *linuxController) Prepare(_ context.Context, serverID string, limits Limits) (string, error) {
	dir := filepath.Join(cgroupBase, serverID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("cgroups v2 unavailable (creating %s — is mccore-runtime.service installed and delegated to the mccore user?): %w", dir, err)
	}

	if limits.MemoryMaxMb > 0 {
		bytes := int64(limits.MemoryMaxMb) * 1024 * 1024
		if err := os.WriteFile(filepath.Join(dir, "memory.max"), []byte(fmt.Sprintf("%d", bytes)), 0644); err != nil {
			return "", fmt.Errorf("writing memory.max: %w", err)
		}
	}
	if limits.CPULimitPercent > 0 {
		// cpu.max format: "<quota> <period>" in microseconds. period=100000
		// (100ms) is the kernel default; quota = period * (percent/100).
		const periodUs = 100000
		quotaUs := periodUs * limits.CPULimitPercent / 100
		val := fmt.Sprintf("%d %d", quotaUs, periodUs)
		if err := os.WriteFile(filepath.Join(dir, "cpu.max"), []byte(val), 0644); err != nil {
			return "", fmt.Errorf("writing cpu.max: %w", err)
		}
	}

	return filepath.Join(dir, "cgroup.procs"), nil
}

func (c *linuxController) Remove(_ context.Context, serverID string) error {
	dir := filepath.Join(cgroupBase, serverID)
	// A cgroup directory can only be rmdir'd once it has no member
	// processes; by the time this is called the server process has
	// already exited, so this is expected to succeed.
	return os.Remove(dir)
}
