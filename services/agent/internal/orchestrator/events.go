package orchestrator

import "github.com/cometa-mccore/mccore/services/agent/internal/protocol"

func (o *Orchestrator) emitInstallProgress(serverID, operationID, stage string, progress float64, message string) {
	err := o.sender.SendEvent("server.install.progress", protocol.InstallProgressEvent{
		ServerID:    serverID,
		OperationID: operationID,
		Stage:       stage,
		Progress:    progress,
		Message:     message,
	})
	if err != nil {
		o.logger.Warn("failed to send install progress event", "error", err)
	}
}

func (o *Orchestrator) emitServerStatus(serverID, status, message string, pid int) {
	err := o.sender.SendEvent("server.status", protocol.ServerStatusEvent{
		ServerID: serverID,
		Status:   status,
		Message:  message,
		Pid:      pid,
	})
	if err != nil {
		o.logger.Warn("failed to send server status event", "error", err)
	}
}

func (o *Orchestrator) emitRestoreProgress(serverID, backupID, operationID, stage string, progress float64, message string) {
	err := o.sender.SendEvent("backup.restore.progress", protocol.RestoreProgressEvent{
		ServerID:    serverID,
		BackupID:    backupID,
		OperationID: operationID,
		Stage:       stage,
		Progress:    progress,
		Message:     message,
	})
	if err != nil {
		o.logger.Warn("failed to send restore progress event", "error", err)
	}
}

func (o *Orchestrator) emitBackupProgress(serverID, backupID, stage string, progress float64, sizeMb float64, checksum, errMsg string) {
	err := o.sender.SendEvent("backup.progress", protocol.BackupProgressEvent{
		ServerID:       serverID,
		BackupID:       backupID,
		Stage:          stage,
		Progress:       progress,
		SizeMb:         sizeMb,
		ChecksumSha256: checksum,
		ErrorMessage:   errMsg,
	})
	if err != nil {
		o.logger.Warn("failed to send backup progress event", "error", err)
	}
}

func (o *Orchestrator) emitPluginProgress(serverID, operationID, fileName, stage string, progress float64, fileSizeMb float64, checksum, errMsg string) {
	err := o.sender.SendEvent("plugin.install.progress", protocol.PluginInstallProgressEvent{
		ServerID:       serverID,
		OperationID:    operationID,
		FileName:       fileName,
		Stage:          stage,
		Progress:       progress,
		FileSizeMb:     fileSizeMb,
		ChecksumSha256: checksum,
		ErrorMessage:   errMsg,
	})
	if err != nil {
		o.logger.Warn("failed to send plugin progress event", "error", err)
	}
}
