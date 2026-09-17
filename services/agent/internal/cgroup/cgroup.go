// Package cgroup applies per-server CPU/memory limits via Linux cgroups v2
// (§64 — the explicit V1 choice over Docker, see docs/architecture.md §2).
// On any system where cgroups v2 isn't available (missing, not mounted, or
// insufficient privilege), Apply logs and returns a non-fatal error so the
// server still starts without resource isolation rather than refusing to
// run at all — isolation here is defense in depth, not a hard requirement
// for the process to function.
package cgroup

import "context"

type Limits struct {
	MemoryMaxMb     int
	CPULimitPercent int // 100 = one full core
}

type Controller interface {
	// Prepare creates the cgroup and writes its limits, returning the
	// cgroup's procs file path to write the child PID into after Start.
	Prepare(ctx context.Context, serverID string, limits Limits) (procsFilePath string, err error)
	Remove(ctx context.Context, serverID string) error
	// Stats reads this server's current resource usage directly from its
	// cgroup. ok is false when no reading is available yet — cgroups v2
	// unsupported/unmounted, the server isn't running, or (for cpuPercent
	// only) this is the first call for serverID and there's no prior
	// sample yet to diff against. Feeds the mcCore Bridge plugin's
	// periodic TPS/MSPT report (see cmd/mcagent) with real per-server
	// cpu/memory numbers instead of leaving those fields at zero.
	Stats(ctx context.Context, serverID string) (cpuPercent float64, memoryUsedMb int64, ok bool)
}
