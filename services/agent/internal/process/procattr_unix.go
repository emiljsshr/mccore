//go:build linux || darwin

package process

import (
	"os/exec"
	"syscall"
)

// applyPlatformProcAttr puts the child in its own process group so Kill can
// signal the whole group (JVM + any subprocesses it spawns) at once
// instead of leaking orphans.
func applyPlatformProcAttr(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}
