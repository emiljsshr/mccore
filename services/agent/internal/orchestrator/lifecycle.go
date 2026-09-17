package orchestrator

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/cometa-mccore/mccore/services/agent/internal/process"
	"github.com/cometa-mccore/mccore/services/agent/internal/protocol"
	"github.com/cometa-mccore/mccore/services/agent/internal/state"
)

const defaultGracePeriod = 30 * time.Second

func (o *Orchestrator) handleStart(cmd protocol.Command) error {
	var p protocol.ServerIDPayload
	if err := json.Unmarshal(cmd.Payload, &p); err != nil {
		return err
	}
	if _, running := o.procMgr.IsRunning(p.ServerID); running {
		return fmt.Errorf("server is already running")
	}
	return o.startProcess(p.ServerID)
}

// startProcess builds the argv (§25 — never a shell string) from the
// on-disk manifest and launches it. Shared by handleStart and
// handleInstall's optional autostart.
func (o *Orchestrator) startProcess(serverID string) error {
	serverDir := o.serverDir(serverID)
	m, err := readManifest(serverDir)
	if err != nil {
		return err
	}

	args := []string{
		// Freshly booted Linux hosts (and sandboxed/virtualized ones) often
		// have a near-empty entropy pool; the JVM's default SecureRandom
		// seeding can block or spin for minutes on /dev/random before
		// Minecraft's key-pair generation step runs. This is the standard,
		// widely-used fix (verified against a real hang while building this
		// agent — see docs/architecture.md) and is safe: it doesn't weaken
		// anything Minecraft itself relies on cryptographic randomness for,
		// since /dev/urandom is CSPRNG-backed on Linux, not a lower-quality
		// source — it just avoids the (sometimes very slow) blocking
		// behavior of the default source under low-entropy conditions.
		"-Djava.security.egd=file:/dev/./urandom",
		fmt.Sprintf("-Xms%dM", m.MemoryMinMb),
		fmt.Sprintf("-Xmx%dM", m.MemoryMaxMb),
		"-jar", m.JarFileName,
	}
	if m.Software != "velocity" {
		args = append(args, "--nogui")
	}

	// Keeps an already-installed server's Bridge plugin in sync with
	// whatever version this Agent binary currently bundles — install and
	// configure already do this, but a server that's just being restarted
	// (the common case after upgrading the Agent) goes through neither, so
	// without this it would keep running a stale jar indefinitely. Best
	// effort: a failure here must never block starting the actual
	// Minecraft process over a bonus feature.
	if err := installBridgePlugin(m.Software, serverDir); err != nil {
		o.logger.Warn("could not refresh mcCore Bridge plugin before start", "serverId", serverID, "err", err)
	}

	o.emitServerStatus(serverID, "starting", "", 0)

	pid, err := o.procMgr.Start(process.StartSpec{
		ServerID:    serverID,
		JavaPath:    m.JavaPath,
		Args:        args,
		WorkDir:     serverDir,
		StateDir:    o.cfg.AgentStatePath,
		CPULimit:    m.CPULimitPercent,
		MemoryMaxMb: m.MemoryMaxMb,
	})
	if err != nil {
		o.emitServerStatus(serverID, "error", err.Error(), 0)
		return err
	}
	_ = o.stateStore.SetServerProcess(serverStateRecord(serverID, pid, m.JavaPath))

	go o.watchForReady(serverID, m.Software)
	return nil
}

// watchForReady polls the console ring buffer for the well-known "server
// finished booting" log line and promotes status to ONLINE once seen —
// see docs/architecture.md for why this heuristic (and not a fragile
// regex as the *primary* signal for TPS/MSPT) is scoped as a fallback: the
// mcCore Bridge plugin, once installed, provides a positive HELLO
// handshake instead. Falls back to a generous timeout so a server with an
// unusual boot message still eventually reports something rather than
// hanging as "starting" forever.
func (o *Orchestrator) watchForReady(serverID, softwareSlug string) {
	deadline := time.Now().Add(10 * time.Minute)
	marker := "Done ("
	if softwareSlug == "velocity" {
		marker = "Listening on"
	}

	for time.Now().Before(deadline) {
		if _, running := o.procMgr.IsRunning(serverID); !running {
			return // exited (crashed or was stopped) before becoming ready — wait() already emitted the status change
		}
		for _, line := range o.procMgr.ConsoleSnapshot(serverID) {
			if strings.Contains(line.Message, marker) {
				pid, _ := o.procMgr.IsRunning(serverID)
				o.emitServerStatus(serverID, "online", "", pid)
				return
			}
		}
		time.Sleep(1 * time.Second)
	}
	o.logger.Warn("server did not report ready within the timeout; leaving status as starting", "serverId", serverID)
}

func (o *Orchestrator) handleStop(cmd protocol.Command) error {
	var p protocol.ServerStopPayload
	if err := json.Unmarshal(cmd.Payload, &p); err != nil {
		return err
	}
	grace := time.Duration(p.GracePeriodSeconds) * time.Second
	if grace <= 0 {
		grace = defaultGracePeriod
	}
	o.emitServerStatus(p.ServerID, "stopping", "", 0)
	exited, err := o.procMgr.Stop(o.cfg.AgentStatePath, p.ServerID, grace)
	if err != nil {
		return err
	}
	if !exited {
		if err := o.procMgr.Kill(p.ServerID); err != nil {
			return fmt.Errorf("graceful stop timed out and force-kill also failed: %w", err)
		}
	}
	_ = o.stateStore.ClearServerProcess(p.ServerID)
	// wait()'s onExit callback (wired in cmd/mcagent) sends the final
	// "offline" status event — not duplicated here.
	return nil
}

func (o *Orchestrator) handleRestart(cmd protocol.Command) error {
	var p protocol.ServerStopPayload
	if err := json.Unmarshal(cmd.Payload, &p); err != nil {
		return err
	}
	o.emitServerStatus(p.ServerID, "restarting", "", 0)
	grace := time.Duration(p.GracePeriodSeconds) * time.Second
	if grace <= 0 {
		grace = defaultGracePeriod
	}
	exited, err := o.procMgr.Stop(o.cfg.AgentStatePath, p.ServerID, grace)
	if err != nil {
		return err
	}
	if !exited {
		if err := o.procMgr.Kill(p.ServerID); err != nil {
			return fmt.Errorf("graceful stop timed out and force-kill also failed: %w", err)
		}
	}
	_ = o.stateStore.ClearServerProcess(p.ServerID)
	// Give the OS a brief moment to release the port before rebinding.
	time.Sleep(500 * time.Millisecond)
	return o.startProcess(p.ServerID)
}

func (o *Orchestrator) handleKill(cmd protocol.Command) error {
	var p protocol.ServerIDPayload
	if err := json.Unmarshal(cmd.Payload, &p); err != nil {
		return err
	}
	o.emitServerStatus(p.ServerID, "stopping", "force kill requested", 0)
	if err := o.procMgr.Kill(p.ServerID); err != nil {
		return err
	}
	_ = o.stateStore.ClearServerProcess(p.ServerID)
	return nil
}

func (o *Orchestrator) handleDelete(cmd protocol.Command) error {
	var p protocol.ServerDeletePayload
	if err := json.Unmarshal(cmd.Payload, &p); err != nil {
		return err
	}
	o.installMu.Lock()
	defer o.installMu.Unlock()

	if _, running := o.procMgr.IsRunning(p.ServerID); running {
		if err := o.procMgr.Kill(p.ServerID); err != nil {
			return fmt.Errorf("stopping server before delete: %w", err)
		}
	}
	_ = o.stateStore.ClearServerProcess(p.ServerID)

	if p.DeleteFiles {
		if err := removeServerDir(o.serverDir(p.ServerID)); err != nil {
			return fmt.Errorf("removing server files: %w", err)
		}
	}
	return nil
}

func (o *Orchestrator) handleConsoleCommand(cmd protocol.Command) error {
	var p protocol.ConsoleCommandPayload
	if err := json.Unmarshal(cmd.Payload, &p); err != nil {
		return err
	}
	return o.procMgr.SendCommand(o.cfg.AgentStatePath, p.ServerID, p.Command)
}

func serverStateRecord(serverID string, pid int, javaPath string) state.ServerProcessRecord {
	return state.ServerProcessRecord{
		ServerID:  serverID,
		Pid:       pid,
		StartedAt: time.Now().UTC().Format(time.RFC3339),
		Cmdline:   javaPath,
	}
}

func removeServerDir(serverDir string) error {
	if serverDir == "" || serverDir == "/" {
		return fmt.Errorf("refusing to remove an empty/root server directory path")
	}
	return os.RemoveAll(serverDir)
}
