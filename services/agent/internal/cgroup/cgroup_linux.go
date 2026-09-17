//go:build linux

package cgroup

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
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

type cpuSample struct {
	usageUsec uint64
	at        time.Time
}

type linuxController struct {
	mu        sync.Mutex
	lastUsage map[string]cpuSample
}

func NewController() Controller { return &linuxController{lastUsage: make(map[string]cpuSample)} }

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

// Stats reads this server's live resource usage straight from the same
// cgroup Prepare set its limits on — real numbers, not a placeholder.
// memoryUsedMb comes from a single memory.current read; cpuPercent is
// derived from the delta in cpu.stat's cumulative usage_usec against the
// previous call, divided by wall-clock elapsed time (not elapsed*cores) —
// matching the "100 = one full core" convention CPULimitPercent already
// uses in Prepare above. The first call for a given serverID (nothing to
// diff against yet, e.g. right after the server started or the Agent
// restarted) returns cpuPercent=0 with ok=true rather than a bogus value.
func (c *linuxController) Stats(_ context.Context, serverID string) (cpuPercent float64, memoryUsedMb int64, ok bool) {
	dir := filepath.Join(cgroupBase, serverID)

	memBytes, err := readCgroupInt(filepath.Join(dir, "memory.current"))
	if err != nil {
		return 0, 0, false
	}
	memoryUsedMb = memBytes / (1024 * 1024)

	usageUsec, err := readCPUUsageUsec(filepath.Join(dir, "cpu.stat"))
	if err != nil {
		return 0, memoryUsedMb, false
	}

	now := time.Now()
	c.mu.Lock()
	prev, have := c.lastUsage[serverID]
	c.lastUsage[serverID] = cpuSample{usageUsec: usageUsec, at: now}
	c.mu.Unlock()

	if !have || usageUsec < prev.usageUsec {
		return 0, memoryUsedMb, true
	}
	elapsed := now.Sub(prev.at).Seconds()
	if elapsed <= 0 {
		return 0, memoryUsedMb, true
	}
	deltaUsec := float64(usageUsec - prev.usageUsec)
	cpuPercent = deltaUsec / (elapsed * 1_000_000) * 100
	if cpuPercent < 0 {
		cpuPercent = 0
	}
	return cpuPercent, memoryUsedMb, true
}

func readCgroupInt(path string) (int64, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return 0, err
	}
	return strconv.ParseInt(strings.TrimSpace(string(data)), 10, 64)
}

func readCPUUsageUsec(path string) (uint64, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return 0, err
	}
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) == 2 && fields[0] == "usage_usec" {
			return strconv.ParseUint(fields[1], 10, 64)
		}
	}
	return 0, fmt.Errorf("usage_usec not found in %s", path)
}
