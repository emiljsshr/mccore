// Package sysinfo detects host facts used for node enrollment (§15) and
// heartbeats (§18/§19). Production target is Ubuntu/Debian (§5) — the
// Linux implementation (sysinfo_linux.go) reads /proc and is what actually
// ships. sysinfo_other.go is a best-effort stub kept only so the agent
// builds and runs for local development on non-Linux machines.
package sysinfo

import "context"

type CPUInfo struct {
	Model string
	Cores int
}

type StaticInfo struct {
	Hostname  string
	OS        string
	Kernel    string
	Arch      string // "amd64" | "arm64"
	CPU       CPUInfo
	MemoryMb  int64
	DiskMb    int64
	IPAddress string
}

type DynamicSample struct {
	CPUUsagePercent float64
	MemoryUsedMb    int64
	MemoryTotalMb   int64
	DiskUsedMb      int64
	DiskTotalMb     int64
	LoadAverage1m   float64
	NetworkInMbps   float64
	NetworkOutMbps  float64
}

type JavaInstallation struct {
	Version string
	Path    string
	Vendor  string
}

// Collector samples dynamic (changing) host metrics; it keeps internal
// state (previous /proc/net/dev counters) so NetworkInMbps/OutMbps can be
// computed as a rate between calls.
type Collector interface {
	Static(ctx context.Context, storagePath string) (StaticInfo, error)
	Sample(ctx context.Context, storagePath string) (DynamicSample, error)
	JavaInstallations(ctx context.Context) ([]JavaInstallation, error)
}

func NormalizedArch(goarch string) string {
	switch goarch {
	case "amd64":
		return "amd64"
	case "arm64":
		return "arm64"
	default:
		return goarch
	}
}
