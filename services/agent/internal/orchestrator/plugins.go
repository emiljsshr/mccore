package orchestrator

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/cometa-mccore/mccore/services/agent/internal/pluginmgr"
	"github.com/cometa-mccore/mccore/services/agent/internal/protocol"
)

func (o *Orchestrator) handlePluginInstall(ctx context.Context, cmd protocol.Command) error {
	var p protocol.PluginInstallPayload
	if err := json.Unmarshal(cmd.Payload, &p); err != nil {
		return err
	}

	o.emitPluginProgress(p.ServerID, p.OperationID, p.TargetFileName, "DOWNLOADING", 20, 0, "", "")

	serverDir := o.serverDir(p.ServerID)
	if err := pluginmgr.Install(ctx, serverDir, p.DownloadURL, p.ExpectedSha512, p.TargetFileName); err != nil {
		o.emitPluginProgress(p.ServerID, p.OperationID, p.TargetFileName, "FAILED", 20, 0, "", err.Error())
		return fmt.Errorf("installing plugin: %w", err)
	}

	pluginPath := filepath.Join(serverDir, "plugins", p.TargetFileName)
	var sizeMb float64
	if info, err := os.Stat(pluginPath); err == nil {
		sizeMb = float64(info.Size()) / (1024 * 1024)
	}

	o.emitPluginProgress(p.ServerID, p.OperationID, p.TargetFileName, "INSTALLING", 90, sizeMb, p.ExpectedSha512, "")
	// A running server picks up a new plugin jar on its next restart —
	// Bukkit/Paper don't support safe hot-loading of arbitrary plugins,
	// so this deliberately does not attempt one; the Control Plane's UI
	// already tells the admin a restart is needed (see src/features/
	// marketplace/install-to-server-dialog.tsx's existing "Restart the
	// server" notice, which this reuses as-is).
	o.emitPluginProgress(p.ServerID, p.OperationID, p.TargetFileName, "COMPLETED", 100, sizeMb, p.ExpectedSha512, "")
	return nil
}

func (o *Orchestrator) handlePluginDelete(cmd protocol.Command) error {
	var p protocol.PluginDeletePayload
	if err := json.Unmarshal(cmd.Payload, &p); err != nil {
		return err
	}
	return pluginmgr.Delete(o.serverDir(p.ServerID), p.FileName)
}
