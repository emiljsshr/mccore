package process

import (
	"os"
	"strconv"
	"strings"
	"syscall"
)

// IsAlive checks that pid still refers to a running process (§26 process
// recovery) AND that it's actually the process we started, not an
// unrelated one that happens to have been assigned the same PID since
// (e.g. after a host reboot). On Linux this reads /proc/<pid>/cmdline; on
// other platforms (local dev only — production is Linux-only, §5) it
// falls back to just the liveness check.
func IsAlive(pid int, expectedJavaPath string) bool {
	if pid <= 0 {
		return false
	}
	// Signal 0 sends nothing but still fails if the process doesn't exist
	// or isn't ours to signal — the standard POSIX "is it alive" check.
	if err := syscall.Kill(pid, 0); err != nil {
		return false
	}
	return cmdlineMatches(pid, expectedJavaPath)
}

func cmdlineMatches(pid int, expectedJavaPath string) bool {
	data, err := os.ReadFile(procCmdlinePath(pid))
	if err != nil {
		// Can't verify (e.g. not Linux, or /proc unavailable) — trust the
		// liveness check alone rather than refusing to adopt a real,
		// running server the Agent itself started.
		return true
	}
	cmdline := strings.ReplaceAll(string(data), "\x00", " ")
	return strings.Contains(cmdline, expectedJavaPath) || expectedJavaPath == ""
}

func procCmdlinePath(pid int) string {
	return "/proc/" + strconv.Itoa(pid) + "/cmdline"
}
