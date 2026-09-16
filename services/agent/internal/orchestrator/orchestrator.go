// Package orchestrator wires every other internal package together to
// actually execute AgentCommands (§4): it's the only place that knows how
// to turn a `server.install` command into "download this jar, write these
// config files, spawn this process" and so on. One command in, one ack
// (+ zero or more progress events) out.
package orchestrator

import (
	"context"
	"encoding/json"
	"log/slog"
	"path/filepath"
	"sync"

	"github.com/cometa-mccore/mccore/services/agent/internal/config"
	"github.com/cometa-mccore/mccore/services/agent/internal/process"
	"github.com/cometa-mccore/mccore/services/agent/internal/protocol"
	"github.com/cometa-mccore/mccore/services/agent/internal/software"
	"github.com/cometa-mccore/mccore/services/agent/internal/state"
	"github.com/cometa-mccore/mccore/services/agent/internal/sysinfo"
)

// Sender is the subset of transport.Client the orchestrator needs — kept
// as an interface so orchestrator tests don't need a real WebSocket.
type Sender interface {
	SendAck(commandID string, ok bool, errorCode, errorMessage string, result any) error
	SendEvent(eventType string, payload any) error
}

type Orchestrator struct {
	cfg        config.Config
	nodeID     string
	procMgr    *process.Manager
	stateStore *state.Store
	sender     Sender
	logger     *slog.Logger

	mu                sync.RWMutex
	javaInstallations []sysinfo.JavaInstallation

	installMu sync.Mutex // serializes install/delete against each other per agent (belt-and-suspenders; CP also holds a per-server lock)
}

func New(cfg config.Config, nodeID string, procMgr *process.Manager, stateStore *state.Store, sender Sender, logger *slog.Logger) *Orchestrator {
	return &Orchestrator{cfg: cfg, nodeID: nodeID, procMgr: procMgr, stateStore: stateStore, sender: sender, logger: logger}
}

// SetSender exists for the two-phase construction main.go needs (the
// transport.Client's command callback closes over this Orchestrator, and
// this Orchestrator's Sender is that same Client) — safe without a mutex
// because the caller only ever invokes this once, synchronously, before
// starting any goroutine that could read `sender` (Go's memory model
// guarantees a `go` statement happens-after everything before it in the
// starting goroutine).
func (o *Orchestrator) SetSender(sender Sender) {
	o.sender = sender
}

func (o *Orchestrator) SetJavaInstallations(installs []sysinfo.JavaInstallation) {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.javaInstallations = installs
}

func (o *Orchestrator) JavaInstallations() []sysinfo.JavaInstallation {
	o.mu.RLock()
	defer o.mu.RUnlock()
	out := make([]sysinfo.JavaInstallation, len(o.javaInstallations))
	copy(out, o.javaInstallations)
	return out
}

func (o *Orchestrator) serverDir(serverID string) string {
	return filepath.Join(o.cfg.StoragePath, serverID)
}

func (o *Orchestrator) backupDir(serverID string) string {
	return filepath.Join(o.cfg.BackupPath, serverID)
}

// Handle dispatches one command to its handler and always sends exactly
// one ack — every handler below returns (result any, err error), and this
// wrapper turns that into the ack frame so individual handlers can't
// forget to ack (which would hang the Control Plane's caller until its
// timeout).
func (o *Orchestrator) Handle(ctx context.Context, cmd protocol.Command) {
	longRunning := cmd.Type == "server.install" || cmd.Type == "server.stop" || cmd.Type == "server.restart" || cmd.Type == "backup.create" || cmd.Type == "backup.restore" || cmd.Type == "plugin.install"
	if longRunning {
		if err := o.sender.SendAck(cmd.CommandID, true, "", "", nil); err != nil {
			o.logger.Error("could not acknowledge accepted operation", "error", err)
			return
		}
		_, err := o.dispatch(ctx, cmd)
		if err != nil {
			o.logger.Warn("operation failed", "commandId", cmd.CommandID, "type", cmd.Type, "error", err)
			if cmd.Type == "server.stop" || cmd.Type == "server.restart" {
				var payload protocol.ServerIDPayload
				if json.Unmarshal(cmd.Payload, &payload) == nil {
					o.emitServerStatus(payload.ServerID, "error", err.Error(), 0)
				}
			}
		}
		return
	}
	result, err := o.dispatch(ctx, cmd)
	if err != nil {
		o.logger.Warn("command failed", "type", cmd.Type, "commandId", cmd.CommandID, "error", err)
		if ackErr := o.sender.SendAck(cmd.CommandID, false, "INTERNAL_ERROR", err.Error(), nil); ackErr != nil {
			o.logger.Error("failed to send failure ack", "error", ackErr)
		}
		return
	}
	if ackErr := o.sender.SendAck(cmd.CommandID, true, "", "", result); ackErr != nil {
		o.logger.Error("failed to send success ack", "error", ackErr)
	}
}

func (o *Orchestrator) dispatch(ctx context.Context, cmd protocol.Command) (any, error) {
	switch cmd.Type {
	case "software.versions":
		var p struct {
			Software string `json:"software"`
		}
		if err := json.Unmarshal(cmd.Payload, &p); err != nil {
			return nil, err
		}
		provider, err := software.GetProvider(p.Software)
		if err != nil {
			return nil, err
		}
		versions, err := provider.ResolveVersions(ctx)
		if err != nil {
			return nil, err
		}
		return map[string]any{"versions": versions}, nil
	case "server.install":
		return nil, o.handleInstall(ctx, cmd)
	case "server.configure":
		return nil, o.handleConfigure(cmd)
	case "server.start":
		return nil, o.handleStart(cmd)
	case "server.stop":
		return nil, o.handleStop(cmd)
	case "server.restart":
		return nil, o.handleRestart(cmd)
	case "server.kill":
		return nil, o.handleKill(cmd)
	case "server.delete":
		return nil, o.handleDelete(cmd)
	case "console.command":
		return nil, o.handleConsoleCommand(cmd)
	case "file.list":
		return o.handleFileList(cmd)
	case "file.read":
		return o.handleFileRead(cmd)
	case "file.write":
		return nil, o.handleFileWrite(cmd)
	case "file.delete":
		return nil, o.handleFileDelete(cmd)
	case "file.rename":
		return nil, o.handleFileRename(cmd)
	case "file.mkdir":
		return nil, o.handleFileMkdir(cmd)
	case "backup.create":
		return nil, o.handleBackupCreate(ctx, cmd)
	case "backup.restore":
		return nil, o.handleBackupRestore(ctx, cmd)
	case "backup.delete":
		return nil, o.handleBackupDelete(cmd)
	case "plugin.install":
		return nil, o.handlePluginInstall(ctx, cmd)
	case "plugin.delete":
		return nil, o.handlePluginDelete(cmd)
	default:
		return nil, unknownCommand(cmd.Type)
	}
}

func unknownCommand(t string) error {
	return &unsupportedCommandError{t}
}

type unsupportedCommandError struct{ t string }

func (e *unsupportedCommandError) Error() string { return "unsupported command type: " + e.t }
