import type { Backup } from "@mccore/database";
import type { BackupDto } from "@mccore/contracts";

export function toBackupDto(backup: Backup): BackupDto {
  return {
    id: backup.id,
    serverId: backup.serverId,
    name: backup.name,
    createdAt: backup.createdAt.toISOString(),
    sizeMb: backup.sizeMb,
    type: backup.type.toLowerCase() as BackupDto["type"],
    status: backup.status.toLowerCase() as BackupDto["status"],
    location: backup.storageProvider,
    includesWorlds: backup.includesWorlds,
    includesPlugins: backup.includesPlugins,
    includesConfig: backup.includesConfig,
    compression: backup.compression as BackupDto["compression"],
    checksumSha256: backup.checksumSha256 ?? undefined,
  };
}
