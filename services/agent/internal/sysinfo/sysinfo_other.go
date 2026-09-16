//go:build !linux

package sysinfo

import (
	"context"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
	"syscall"
)

// otherCollector is a best-effort implementation used only so the agent
// builds and runs for local development on non-Linux machines (§5 limits
// production support to Ubuntu/Debian; sysinfo_linux.go is what actually
// ships). It intentionally does not try to match /proc-derived precision.
type otherCollector struct{}

func NewCollector() Collector { return &otherCollector{} }

func (o *otherCollector) Static(_ context.Context, storagePath string) (StaticInfo, error) {
	hostname, _ := os.Hostname()
	totalMb, _ := diskTotalMb(storagePath)
	return StaticInfo{
		Hostname:  hostname,
		OS:        runtime.GOOS,
		Kernel:    runtime.GOOS,
		Arch:      NormalizedArch(runtime.GOARCH),
		CPU:       CPUInfo{Model: "unknown (non-Linux dev build)", Cores: runtime.NumCPU()},
		MemoryMb:  0,
		DiskMb:    totalMb,
		IPAddress: "127.0.0.1",
	}, nil
}

func (o *otherCollector) Sample(_ context.Context, storagePath string) (DynamicSample, error) {
	totalMb, usedMb := diskTotalMb(storagePath)
	return DynamicSample{DiskTotalMb: totalMb, DiskUsedMb: usedMb}, nil
}

func diskTotalMb(path string) (int64, int64) {
	_ = os.MkdirAll(path, 0755)
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return 0, 0
	}
	totalBytes := uint64(stat.Blocks) * uint64(stat.Bsize)
	freeBytes := uint64(stat.Bavail) * uint64(stat.Bsize)
	return int64(totalBytes / (1024 * 1024)), int64((totalBytes - freeBytes) / (1024 * 1024))
}

var javaVersionRe = regexp.MustCompile(`version "([^"]+)"`)

func (o *otherCollector) JavaInstallations(ctx context.Context) ([]JavaInstallation, error) {
	path, err := exec.LookPath("java")
	if err != nil {
		return nil, nil
	}
	out, _ := exec.CommandContext(ctx, path, "-version").CombinedOutput()
	match := javaVersionRe.FindStringSubmatch(string(out))
	if match == nil {
		return nil, nil
	}
	vendor := "Unknown"
	if strings.Contains(string(out), "OpenJDK") {
		vendor = "OpenJDK"
	}
	return []JavaInstallation{{Version: match[1], Path: path, Vendor: vendor}}, nil
}
