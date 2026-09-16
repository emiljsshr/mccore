//go:build linux

package sysinfo

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/sys/unix"
)

type linuxCollector struct {
	mu          sync.Mutex
	lastNetTime time.Time
	lastRxBytes uint64
	lastTxBytes uint64
	lastCPU     cpuTimes
	haveLastCPU bool
}

func NewCollector() Collector {
	return &linuxCollector{}
}

func (c *linuxCollector) Static(_ context.Context, storagePath string) (StaticInfo, error) {
	hostname, _ := os.Hostname()

	var uts unix.Utsname
	kernel := ""
	if err := unix.Uname(&uts); err == nil {
		kernel = cToString(uts.Release[:])
	}

	osName := readOSRelease()

	model, cores := cpuModelAndCores()

	memTotalMb, _, err := readMeminfo()
	if err != nil {
		return StaticInfo{}, fmt.Errorf("reading /proc/meminfo: %w", err)
	}

	diskTotalMb, _, err := diskUsageMb(storagePath)
	if err != nil {
		return StaticInfo{}, fmt.Errorf("statfs %s: %w", storagePath, err)
	}

	return StaticInfo{
		Hostname:  hostname,
		OS:        osName,
		Kernel:    kernel,
		Arch:      NormalizedArch(runtime.GOARCH),
		CPU:       CPUInfo{Model: model, Cores: cores},
		MemoryMb:  memTotalMb,
		DiskMb:    diskTotalMb,
		IPAddress: outboundIP(),
	}, nil
}

func (c *linuxCollector) Sample(_ context.Context, storagePath string) (DynamicSample, error) {
	memTotalMb, memUsedMb, err := readMeminfo()
	if err != nil {
		return DynamicSample{}, err
	}
	diskTotalMb, diskUsedMb, err := diskUsageMb(storagePath)
	if err != nil {
		return DynamicSample{}, err
	}
	load1, err := readLoadAvg1()
	if err != nil {
		return DynamicSample{}, err
	}

	cpuPercent := c.sampleCPUPercent()
	rxMbps, txMbps := c.sampleNetworkMbps()

	return DynamicSample{
		CPUUsagePercent: cpuPercent,
		MemoryUsedMb:    memUsedMb,
		MemoryTotalMb:   memTotalMb,
		DiskUsedMb:      diskUsedMb,
		DiskTotalMb:     diskTotalMb,
		LoadAverage1m:   load1,
		NetworkInMbps:   rxMbps,
		NetworkOutMbps:  txMbps,
	}, nil
}

// ------------------------------------------------------------- CPU percent

type cpuTimes struct {
	idle  uint64
	total uint64
}

func readCPUTimes() (cpuTimes, error) {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return cpuTimes{}, err
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	if !scanner.Scan() {
		return cpuTimes{}, fmt.Errorf("empty /proc/stat")
	}
	fields := strings.Fields(scanner.Text())
	if len(fields) < 8 || fields[0] != "cpu" {
		return cpuTimes{}, fmt.Errorf("unexpected /proc/stat format")
	}
	var total uint64
	var idle uint64
	for i, f := range fields[1:] {
		v, err := strconv.ParseUint(f, 10, 64)
		if err != nil {
			continue
		}
		total += v
		if i == 3 { // idle field
			idle = v
		}
	}
	return cpuTimes{idle: idle, total: total}, nil
}

func (c *linuxCollector) sampleCPUPercent() float64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	cur, err := readCPUTimes()
	if err != nil {
		return 0
	}
	if !c.haveLastCPU {
		c.lastCPU = cur
		c.haveLastCPU = true
		return 0
	}
	deltaTotal := float64(cur.total - c.lastCPU.total)
	deltaIdle := float64(cur.idle - c.lastCPU.idle)
	c.lastCPU = cur
	if deltaTotal <= 0 {
		return 0
	}
	usage := (1 - deltaIdle/deltaTotal) * 100
	if usage < 0 {
		usage = 0
	}
	if usage > 100 {
		usage = 100
	}
	return usage
}

// ----------------------------------------------------------------- Network

func (c *linuxCollector) sampleNetworkMbps() (float64, float64) {
	rx, tx, err := readNetDevTotals()
	if err != nil {
		return 0, 0
	}
	now := time.Now()
	if c.lastNetTime.IsZero() {
		c.lastNetTime = now
		c.lastRxBytes = rx
		c.lastTxBytes = tx
		return 0, 0
	}
	elapsed := now.Sub(c.lastNetTime).Seconds()
	if elapsed <= 0 {
		return 0, 0
	}
	rxMbps := bytesDeltaToMbps(rx, c.lastRxBytes, elapsed)
	txMbps := bytesDeltaToMbps(tx, c.lastTxBytes, elapsed)
	c.lastNetTime = now
	c.lastRxBytes = rx
	c.lastTxBytes = tx
	return rxMbps, txMbps
}

func bytesDeltaToMbps(cur, prev uint64, elapsedSeconds float64) float64 {
	if cur < prev {
		return 0 // counter reset (interface bounce) — report 0 for this tick rather than a bogus negative
	}
	deltaBits := float64(cur-prev) * 8
	return deltaBits / elapsedSeconds / 1_000_000
}

func readNetDevTotals() (rx uint64, tx uint64, err error) {
	f, err := os.Open("/proc/net/dev")
	if err != nil {
		return 0, 0, err
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	lineNum := 0
	for scanner.Scan() {
		lineNum++
		if lineNum <= 2 {
			continue // header lines
		}
		line := scanner.Text()
		colon := strings.IndexByte(line, ':')
		if colon < 0 {
			continue
		}
		iface := strings.TrimSpace(line[:colon])
		if iface == "lo" {
			continue
		}
		fields := strings.Fields(line[colon+1:])
		if len(fields) < 9 {
			continue
		}
		if v, err := strconv.ParseUint(fields[0], 10, 64); err == nil {
			rx += v
		}
		if v, err := strconv.ParseUint(fields[8], 10, 64); err == nil {
			tx += v
		}
	}
	return rx, tx, scanner.Err()
}

// -------------------------------------------------------------------- Misc

func readMeminfo() (totalMb, usedMb int64, err error) {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0, 0, err
	}
	defer f.Close()
	values := map[string]int64{}
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		colon := strings.IndexByte(line, ':')
		if colon < 0 {
			continue
		}
		key := line[:colon]
		rest := strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(line[colon+1:]), " kB"))
		v, convErr := strconv.ParseInt(strings.TrimSuffix(rest, " kB"), 10, 64)
		if convErr != nil {
			fields := strings.Fields(line[colon+1:])
			if len(fields) > 0 {
				v, _ = strconv.ParseInt(fields[0], 10, 64)
			}
		}
		values[key] = v
	}
	totalKb := values["MemTotal"]
	availKb := values["MemAvailable"]
	totalMb = totalKb / 1024
	usedMb = (totalKb - availKb) / 1024
	return totalMb, usedMb, scanner.Err()
}

func readLoadAvg1() (float64, error) {
	data, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return 0, err
	}
	fields := strings.Fields(string(data))
	if len(fields) < 1 {
		return 0, fmt.Errorf("unexpected /proc/loadavg format")
	}
	return strconv.ParseFloat(fields[0], 64)
}

func diskUsageMb(path string) (totalMb, usedMb int64, err error) {
	if err := os.MkdirAll(path, 0755); err != nil {
		return 0, 0, err
	}
	var stat unix.Statfs_t
	if err := unix.Statfs(path, &stat); err != nil {
		return 0, 0, err
	}
	blockSize := uint64(stat.Bsize)
	totalBytes := stat.Blocks * blockSize
	freeBytes := stat.Bavail * blockSize
	totalMb = int64(totalBytes / (1024 * 1024))
	usedMb = int64((totalBytes - freeBytes) / (1024 * 1024))
	return totalMb, usedMb, nil
}

func cpuModelAndCores() (string, int) {
	cores := runtime.NumCPU()
	model := "unknown"
	f, err := os.Open("/proc/cpuinfo")
	if err != nil {
		return model, cores
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "model name") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				model = strings.TrimSpace(parts[1])
				break
			}
		}
	}
	return model, cores
}

func readOSRelease() string {
	f, err := os.Open("/etc/os-release")
	if err != nil {
		return runtime.GOOS
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "PRETTY_NAME=") {
			return strings.Trim(strings.TrimPrefix(line, "PRETTY_NAME="), `"`)
		}
	}
	return runtime.GOOS
}

func cToString(b []byte) string {
	n := 0
	for n < len(b) && b[n] != 0 {
		n++
	}
	return string(b[:n])
}

func outboundIP() string {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return "127.0.0.1"
	}
	defer conn.Close()
	addr, ok := conn.LocalAddr().(*net.UDPAddr)
	if !ok {
		return "127.0.0.1"
	}
	return addr.IP.String()
}

// ------------------------------------------------------------------- Java

var javaVersionRe = regexp.MustCompile(`version "([^"]+)"`)

// JavaInstallations scans the well-known locations Debian/Ubuntu and the
// common third-party distributions (Temurin, Corretto, Zulu) install to,
// plus whatever `update-alternatives` knows about, and resolves each
// candidate's version by invoking it directly — never through a shell, and
// only ever against paths this function itself discovered (never a
// user-supplied path).
func (c *linuxCollector) JavaInstallations(ctx context.Context) ([]JavaInstallation, error) {
	candidates := map[string]bool{}

	globs := []string{
		"/usr/lib/jvm/*/bin/java",
		"/opt/java/*/bin/java",
	}
	for _, pattern := range globs {
		matches, _ := filepath.Glob(pattern)
		for _, m := range matches {
			candidates[m] = true
		}
	}

	if out, err := exec.CommandContext(ctx, "update-alternatives", "--list", "java").Output(); err == nil {
		for _, line := range strings.Split(string(out), "\n") {
			line = strings.TrimSpace(line)
			if line != "" {
				candidates[line] = true
			}
		}
	}

	var results []JavaInstallation
	for path := range candidates {
		info, err := os.Stat(path)
		if err != nil || info.IsDir() {
			continue
		}
		version, vendor, err := probeJavaVersion(ctx, path)
		if err != nil {
			continue
		}
		results = append(results, JavaInstallation{Version: version, Path: path, Vendor: vendor})
	}
	return results, nil
}

func probeJavaVersion(ctx context.Context, javaPath string) (version string, vendor string, err error) {
	// `java -version` prints to stderr, e.g.:
	//   openjdk version "21.0.4" 2024-07-16
	//   OpenJDK Runtime Environment Temurin-21.0.4+7 (build ...)
	cmd := exec.CommandContext(ctx, javaPath, "-version")
	out, runErr := cmd.CombinedOutput()
	text := string(out)
	match := javaVersionRe.FindStringSubmatch(text)
	if match == nil {
		return "", "", fmt.Errorf("could not parse java version from %s: %w", javaPath, runErr)
	}
	version = match[1]
	switch {
	case strings.Contains(text, "Temurin"):
		vendor = "Eclipse Temurin"
	case strings.Contains(text, "Corretto"):
		vendor = "Amazon Corretto"
	case strings.Contains(text, "Zulu"):
		vendor = "Azul Zulu"
	case strings.Contains(text, "OpenJDK"):
		vendor = "OpenJDK"
	default:
		vendor = "Unknown"
	}
	return version, vendor, nil
}
