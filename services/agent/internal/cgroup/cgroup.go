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
}
