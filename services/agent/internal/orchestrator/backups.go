package orchestrator

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/cometa-mccore/mccore/services/agent/internal/backup"
	"github.com/cometa-mccore/mccore/services/agent/internal/protocol"
)

func (o *Orchestrator) backupFilePath(serverID, backupID string) string {
	return filepath.Join(o.backupDir(serverID), backupID+".tar.zst")
}

// handleBackupCreate implements the §38 workflow: save-all/save-off only
// if the server is actually running (a stopped server has nothing to
// flush and no risk of writing mid-archive), archive, hash, save-on.
func (o *Orchestrator) handleBackupCreate(ctx context.Context, cmd protocol.Command) error {
	var p protocol.BackupCreatePayload
	if err := json.Unmarshal(cmd.Payload, &p); err != nil {
		return err
	}

	o.emitBackupProgress(p.ServerID, p.BackupID, "PREPARING", 5, 0, "", "")

	serverDir := o.serverDir(p.ServerID)
	_, running := o.procMgr.IsRunning(p.ServerID)
	if running {
		o.emitBackupProgress(p.ServerID, p.BackupID, "SAVING", 15, 0, "", "")
		_ = o.procMgr.SendCommand(o.cfg.AgentStatePath, p.ServerID, "save-off")
		_ = o.procMgr.SendCommand(o.cfg.AgentStatePath, p.ServerID, "save-all flush")
		// Give the server a moment to actually flush world data to disk
		// before we start archiving it — save-all's console ack isn't
		// synchronous with the disk writes completing.
		time.Sleep(3 * time.Second)
	}

	if err := os.MkdirAll(o.backupDir(p.ServerID), 0755); err != nil {
		o.restoreSaveOn(p.ServerID, running)
		o.emitBackupProgress(p.ServerID, p.BackupID, "FAILED", 0, 0, "", err.Error())
		return err
	}

	destPath := o.backupFilePath(p.ServerID, p.BackupID)
	result, err := backup.Create(ctx, serverDir, destPath, backup.CreateOptions{
		IncludesWorlds:  p.IncludesWorlds,
		IncludesPlugins: p.IncludesPlugins,
		IncludesConfig:  p.IncludesConfig,
		Compression:     p.Compression,
	}, func(percent float64) {
		o.emitBackupProgress(p.ServerID, p.BackupID, "COMPRESSING", 20+percent*0.6, 0, "", "")
	})

	o.restoreSaveOn(p.ServerID, running)

	if err != nil {
		o.emitBackupProgress(p.ServerID, p.BackupID, "FAILED", 0, 0, "", err.Error())
		return fmt.Errorf("creating backup: %w", err)
	}

	sizeMb := float64(result.SizeBytes) / (1024 * 1024)
	o.emitBackupProgress(p.ServerID, p.BackupID, "HASHING", 95, sizeMb, result.Sha256, "")
	o.emitBackupProgress(p.ServerID, p.BackupID, "COMPLETED", 100, sizeMb, result.Sha256, "")
	return nil
}

func (o *Orchestrator) restoreSaveOn(serverID string, wasRunning bool) {
	if wasRunning {
		_ = o.procMgr.SendCommand(o.cfg.AgentStatePath, serverID, "save-on")
	}
}

// handleBackupRestore implements §39: stop → verify checksum → extract to
// a staging dir → atomic swap → restart only if it was running before.
func (o *Orchestrator) handleBackupRestore(ctx context.Context, cmd protocol.Command) error {
	var p protocol.BackupRestorePayload
	if err := json.Unmarshal(cmd.Payload, &p); err != nil {
		return err
	}
	operationID := p.OperationID

	o.emitRestoreProgress(p.ServerID, p.BackupID, operationID, "PREPARING", 5, "")

	backupPath := o.backupFilePath(p.ServerID, p.BackupID)
	if _, err := os.Stat(backupPath); err != nil {
		o.emitRestoreProgress(p.ServerID, p.BackupID, operationID, "FAILED", 0, err.Error())
		return fmt.Errorf("backup file not found: %w", err)
	}
	if p.ExpectedSha256 != "" {
		if err := backup.VerifyChecksum(backupPath, p.ExpectedSha256); err != nil {
			o.emitRestoreProgress(p.ServerID, p.BackupID, operationID, "FAILED", 10, err.Error())
			return err
		}
	}

	_, wasRunning := o.procMgr.IsRunning(p.ServerID)
	if wasRunning {
		o.emitRestoreProgress(p.ServerID, p.BackupID, operationID, "STOPPING", 15, "")
		o.emitServerStatus(p.ServerID, "stopping", "restoring from backup", 0)
		exited, err := o.procMgr.Stop(o.cfg.AgentStatePath, p.ServerID, defaultGracePeriod)
		if err != nil {
			o.emitRestoreProgress(p.ServerID, p.BackupID, operationID, "FAILED", 15, err.Error())
			return err
		}
		if !exited {
			_ = o.procMgr.Kill(p.ServerID)
		}
		_ = o.stateStore.ClearServerProcess(p.ServerID)
	}

	o.emitRestoreProgress(p.ServerID, p.BackupID, operationID, "VERIFYING", 30, "")
	// Checksum verification already happened above (before stopping the
	// server, if it wasn't already) — this stage covers the extraction
	// itself failing loudly on a truncated/corrupt archive.

	o.emitRestoreProgress(p.ServerID, p.BackupID, operationID, "RESTORING", 45, "")
	if _, err := backup.Restore(ctx, backupPath, o.serverDir(p.ServerID)); err != nil {
		o.emitRestoreProgress(p.ServerID, p.BackupID, operationID, "FAILED", 45, err.Error())
		o.emitServerStatus(p.ServerID, "error", "restore failed: "+err.Error(), 0)
		return fmt.Errorf("restoring backup: %w", err)
	}

	if wasRunning {
		o.emitRestoreProgress(p.ServerID, p.BackupID, operationID, "STARTING", 85, "")
		if err := o.startProcess(p.ServerID); err != nil {
			o.emitRestoreProgress(p.ServerID, p.BackupID, operationID, "FAILED", 85, err.Error())
			return fmt.Errorf("starting server after restore: %w", err)
		}
	} else {
		o.emitServerStatus(p.ServerID, "offline", "", 0)
	}

	o.emitRestoreProgress(p.ServerID, p.BackupID, operationID, "COMPLETED", 100, "")
	return nil
}

func (o *Orchestrator) handleBackupDelete(cmd protocol.Command) error {
	var p protocol.BackupDeletePayload
	if err := json.Unmarshal(cmd.Payload, &p); err != nil {
		return err
	}
	path := o.backupFilePath(p.ServerID, p.BackupID)
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("removing backup file: %w", err)
	}
	return nil
}
