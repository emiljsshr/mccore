// Command mcagent is the mcCore Node Agent daemon (§15–§19). Installed as
// the mccore-agent systemd service; see installer/systemd/mccore-agent.service.
package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cometa-mccore/mccore/services/agent/internal/cgroup"
	"github.com/cometa-mccore/mccore/services/agent/internal/config"
	"github.com/cometa-mccore/mccore/services/agent/internal/identity"
	"github.com/cometa-mccore/mccore/services/agent/internal/orchestrator"
	"github.com/cometa-mccore/mccore/services/agent/internal/process"
	"github.com/cometa-mccore/mccore/services/agent/internal/protocol"
	"github.com/cometa-mccore/mccore/services/agent/internal/state"
	"github.com/cometa-mccore/mccore/services/agent/internal/sysinfo"
	"github.com/cometa-mccore/mccore/services/agent/internal/transport"
)

const AgentVersion = "0.1.0"

func main() {
	configPath := flag.String("config", "/etc/mccore/mccore.env", "path to the agent's env-style config file")
	flag.Parse()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg, err := config.Load(*configPath)
	if err != nil {
		logger.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	if err := run(cfg, logger); err != nil {
		logger.Error("agent exited with error", "error", err)
		os.Exit(1)
	}
}

func run(cfg config.Config, logger *slog.Logger) error {
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	stateStore, err := state.Open(cfg.AgentStatePath)
	if err != nil {
		return fmt.Errorf("opening state store: %w", err)
	}

	id, err := identity.LoadOrCreate(cfg.AgentStatePath)
	if err != nil {
		return fmt.Errorf("loading node identity: %w", err)
	}

	collector := sysinfo.NewCollector()

	nodeID := stateStore.NodeID()
	if nodeID == "" {
		nodeID, err = enrollFirstRun(ctx, cfg, id, collector, logger)
		if err != nil {
			return fmt.Errorf("enrollment failed: %w", err)
		}
		if err := stateStore.SetNodeID(nodeID); err != nil {
			return fmt.Errorf("persisting node id: %w", err)
		}
		logger.Info("enrolled with control plane", "nodeId", nodeID)
	} else {
		logger.Info("using previously enrolled node identity", "nodeId", nodeID)
	}

	// Two-phase construction: transport.Client's onCommand needs the
	// Orchestrator, and the Orchestrator's Sender needs the Client. Both
	// are only ever *invoked* after both are fully constructed below.
	var client *transport.Client
	var orch *orchestrator.Orchestrator

	cgroupController := cgroup.NewController()
	procMgr := process.NewManager(
		cgroupController,
		func(serverID string, lines []protocol.ConsoleLine) {
			if client == nil || !client.IsConnected() {
				return
			}
			if err := client.SendEvent("server.console", protocol.ServerConsoleEvent{ServerID: serverID, Lines: lines}); err != nil {
				logger.Warn("failed to send console event", "error", err, "serverId", serverID)
			}
		},
		func(info process.ExitInfo) {
			status := "offline"
			message := ""
			if info.Err != nil {
				status = "crashed"
				message = info.Err.Error()
			}
			if client != nil && client.IsConnected() {
				_ = client.SendEvent("server.status", protocol.ServerStatusEvent{ServerID: info.ServerID, Status: status, Message: message})
			}
			_ = stateStore.ClearServerProcess(info.ServerID)
		},
	)

	orch = orchestrator.New(cfg, nodeID, procMgr, stateStore, nil, logger) // Sender set just below once client exists

	client = transport.New(cfg.ControlPlaneURL, nodeID, id, AgentVersion, logger, func(cmd protocol.Command) {
		orch.Handle(ctx, cmd)
	})
	orch.SetSender(client)

	recoverServerProcesses(cfg.AgentStatePath, stateStore, procMgr, logger)

	go client.Run(ctx)
	go heartbeatLoop(ctx, cfg, nodeID, collector, procMgr, orch, client, logger)
	go serveHealthEndpoint(ctx, cfg, client, logger)

	<-ctx.Done()
	logger.Info("shutting down (Minecraft server processes are left running — see docs/architecture.md §26)")
	return nil
}

func enrollFirstRun(ctx context.Context, cfg config.Config, id *identity.Identity, collector sysinfo.Collector, logger *slog.Logger) (string, error) {
	if cfg.EnrollmentToken == "" {
		return "", fmt.Errorf("no node id in local state and no AGENT_ENROLLMENT_TOKEN configured — run the installer or `mccore agent enroll --token <token>`")
	}
	static, err := collector.Static(ctx, cfg.StoragePath)
	if err != nil {
		return "", fmt.Errorf("detecting host info: %w", err)
	}
	javaInstalls, err := collector.JavaInstallations(ctx)
	if err != nil {
		logger.Warn("java detection failed during enrollment", "error", err)
	}

	req := protocol.EnrollRequest{
		EnrollmentToken:   cfg.EnrollmentToken,
		PublicKey:         id.PublicKeyBase64(),
		Hostname:          static.Hostname,
		OS:                static.OS,
		Kernel:            static.Kernel,
		Arch:              static.Arch,
		CPUModel:          static.CPU.Model,
		CPUCores:          static.CPU.Cores,
		MemoryTotalMb:     static.MemoryMb,
		DiskTotalMb:       static.DiskMb,
		IPAddress:         static.IPAddress,
		JavaInstallations: toProtocolJava(javaInstalls),
		AgentVersion:      AgentVersion,
		ProtocolVersion:   protocol.ProtocolVersion,
	}
	resp, err := transport.Enroll(ctx, cfg.ControlPlaneURL, req)
	if err != nil {
		return "", err
	}
	return resp.NodeID, nil
}

func toProtocolJava(installs []sysinfo.JavaInstallation) []protocol.JavaInstallation {
	out := make([]protocol.JavaInstallation, len(installs))
	for i, j := range installs {
		out[i] = protocol.JavaInstallation{Version: j.Version, Path: j.Path, Vendor: j.Vendor}
	}
	return out
}

// recoverServerProcesses implements §26: after an Agent restart, verify
// which previously-tracked server processes are still actually alive
// (matching both PID and the recorded java binary path) before trusting
// them — anything else is dropped as stale rather than silently adopted.
func recoverServerProcesses(agentStatePath string, stateStore *state.Store, procMgr *process.Manager, logger *slog.Logger) {
	for serverID, rec := range stateStore.ServerProcesses() {
		if process.IsAlive(rec.Pid, rec.Cmdline) {
			procMgr.AdoptExisting(serverID, rec.Pid, agentStatePath)
			logger.Info("recovered running server process", "serverId", serverID, "pid", rec.Pid)
		} else {
			logger.Info("stale process record dropped (process no longer running)", "serverId", serverID, "pid", rec.Pid)
			_ = stateStore.ClearServerProcess(serverID)
		}
	}
}

func heartbeatLoop(ctx context.Context, cfg config.Config, nodeID string, collector sysinfo.Collector, procMgr *process.Manager, orch *orchestrator.Orchestrator, client *transport.Client, logger *slog.Logger) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	javaRefresh := time.NewTicker(5 * time.Minute)
	defer javaRefresh.Stop()

	refreshJava := func() {
		installs, err := collector.JavaInstallations(ctx)
		if err != nil {
			logger.Warn("java detection failed", "error", err)
			return
		}
		orch.SetJavaInstallations(installs)
	}
	refreshJava()

	for {
		select {
		case <-ctx.Done():
			return
		case <-javaRefresh.C:
			refreshJava()
		case <-ticker.C:
			if !client.IsConnected() {
				continue
			}
			sample, err := collector.Sample(ctx, cfg.StoragePath)
			if err != nil {
				logger.Warn("failed to sample host metrics", "error", err)
				continue
			}
			hb := protocol.Heartbeat{
				NodeID:            nodeID,
				AgentVersion:      AgentVersion,
				Timestamp:         time.Now().UTC().Format(time.RFC3339),
				CPUUsagePercent:   sample.CPUUsagePercent,
				MemoryUsedMb:      sample.MemoryUsedMb,
				MemoryTotalMb:     sample.MemoryTotalMb,
				DiskUsedMb:        sample.DiskUsedMb,
				DiskTotalMb:       sample.DiskTotalMb,
				LoadAverage1m:     sample.LoadAverage1m,
				NetworkInMbps:     sample.NetworkInMbps,
				NetworkOutMbps:    sample.NetworkOutMbps,
				JavaInstallations: toProtocolJava(orch.JavaInstallations()),
				RunningServerIds:  procMgr.RunningServerIDs(),
			}
			if err := client.SendHeartbeat(hb); err != nil {
				logger.Warn("failed to send heartbeat", "error", err)
			}
		}
	}
}

// serveHealthEndpoint implements §50's local Agent health check, bound
// only to loopback — used by `mccore doctor` and the installer, never
// exposed to the network.
func serveHealthEndpoint(ctx context.Context, cfg config.Config, client *transport.Client, logger *slog.Logger) {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if client.IsConnected() {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"ok","connected":true}`))
			return
		}
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte(`{"status":"degraded","connected":false}`))
	})
	server := &http.Server{Addr: cfg.HealthListenAddr, Handler: mux}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Warn("health endpoint stopped", "error", err)
	}
}
