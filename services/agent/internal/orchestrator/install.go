package orchestrator

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/cometa-mccore/mccore/services/agent/internal/java"
	"github.com/cometa-mccore/mccore/services/agent/internal/protocol"
	"github.com/cometa-mccore/mccore/services/agent/internal/software"
)

// handleInstall runs the full §22 pipeline: prepare → download → verify →
// configure → ready → (optionally) start. Every stage emits a
// `server.install.progress` event so the Control Plane can relay live
// progress to the browser; a failure at any stage emits a FAILED stage and
// returns an error (which Handle() turns into a failed ack).
func (o *Orchestrator) handleInstall(ctx context.Context, cmd protocol.Command) error {
	o.installMu.Lock()
	defer o.installMu.Unlock()

	var p protocol.ServerInstallPayload
	if err := json.Unmarshal(cmd.Payload, &p); err != nil {
		return fmt.Errorf("invalid server.install payload: %w", err)
	}
	if !p.EulaAccepted {
		return fmt.Errorf("refusing to install: EULA not marked accepted in the command payload")
	}

	serverDir := o.serverDir(p.ServerID)
	emit := func(stage string, progress float64, message string) {
		o.emitInstallProgress(p.ServerID, cmd.CommandID, stage, progress, message)
	}

	emit("PREPARING", 5, "Creating server directory")
	if err := os.MkdirAll(serverDir, 0755); err != nil {
		emit("FAILED", 0, err.Error())
		return fmt.Errorf("creating server directory: %w", err)
	}

	selector := p.JavaSelector
	if selector == "" {
		selector = java.SelectorForMinecraftVersion(p.MinecraftVersion)
	}
	resolver := java.NewResolver(o.JavaInstallations())
	javaInstall, err := resolver.Resolve(selector)
	if err != nil {
		emit("FAILED", 5, err.Error())
		return fmt.Errorf("resolving Java runtime: %w", err)
	}

	provider, err := software.GetProvider(p.Software)
	if err != nil {
		emit("FAILED", 5, err.Error())
		return err
	}

	emit("DOWNLOADING", 15, fmt.Sprintf("Resolving %s %s", p.Software, p.MinecraftVersion))
	build, err := provider.ResolveBuild(ctx, p.MinecraftVersion, p.Build)
	if err != nil {
		emit("FAILED", 15, err.Error())
		return fmt.Errorf("resolving software build: %w", err)
	}

	jarFileName := build.FileName
	if jarFileName == "" {
		jarFileName = "server.jar"
	}
	destPath := serverDir + string(os.PathSeparator) + jarFileName

	emit("DOWNLOADING", 30, fmt.Sprintf("Downloading %s", build.FileName))
	if err := software.Download(ctx, build.DownloadURL, destPath, build); err != nil {
		emit("FAILED", 30, err.Error())
		return fmt.Errorf("downloading server software: %w", err)
	}

	emit("VERIFYING", 70, "Verifying download")
	// software.Download already verified the checksum inline while
	// streaming — this stage exists for UI feedback continuity, not
	// because there's separate work to do here.

	emit("CONFIGURING", 80, "Writing configuration")
	if p.Software == "velocity" {
		if err := writeVelocityConfig(serverDir, p); err != nil {
			emit("FAILED", 80, err.Error())
			return fmt.Errorf("writing velocity.toml: %w", err)
		}
	} else {
		if err := writeEula(serverDir); err != nil {
			emit("FAILED", 80, err.Error())
			return fmt.Errorf("writing eula.txt: %w", err)
		}
		if err := writeServerProperties(serverDir, p); err != nil {
			emit("FAILED", 80, err.Error())
			return fmt.Errorf("writing server.properties: %w", err)
		}
	}
	if err := writeServerIcon(serverDir, p.ServerIconBase64); err != nil {
		emit("FAILED", 80, err.Error())
		return fmt.Errorf("writing server-icon.png: %w", err)
	}

	if err := writeManifest(serverDir, manifest{
		Software:        p.Software,
		JarFileName:     jarFileName,
		JavaPath:        javaInstall.Path,
		MemoryMinMb:     p.MemoryMinMb,
		MemoryMaxMb:     p.MemoryMaxMb,
		CPULimitPercent: p.CPULimitPercent,
		DiskLimitMb:     p.DiskLimitMb,
	}); err != nil {
		emit("FAILED", 90, err.Error())
		return fmt.Errorf("writing server manifest: %w", err)
	}

	emit("READY", 100, "Installation complete")

	if p.AutoStart {
		emit("STARTING", 100, "Starting server")
		if err := o.startProcess(p.ServerID); err != nil {
			o.emitServerStatus(p.ServerID, "error", err.Error(), 0)
			return fmt.Errorf("starting server after install: %w", err)
		}
	}

	return nil
}
