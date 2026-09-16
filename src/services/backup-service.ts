import { waitForOperation } from "./operation-service";
import type { OperationDto } from "@mccore/contracts";
import type { Backup } from "@/types";
import { api, mutation } from "@/lib/api";
import { useBackupStore } from "@/stores/use-backup-store";
export async function listBackups(serverId: string): Promise<Backup[]> {
  const { backups } = await api<{ backups: Backup[] }>(`/servers/${serverId}/backups`);
  useBackupStore.setState(s => ({ backups: [...s.backups.filter(b => b.serverId !== serverId), ...backups] })); return backups;
}
export interface CreateBackupInput { serverId: string; name: string; includeWorlds: boolean; includePlugins: boolean; includeConfig: boolean; compression: Backup["compression"]; }
export async function createBackup(input: CreateBackupInput): Promise<Backup> {
  const { backup, operation } = await api<{ backup: Backup; operation: OperationDto }>(`/servers/${input.serverId}/backups`, mutation("POST", { name: input.name, includesWorlds: input.includeWorlds, includesPlugins: input.includePlugins, includesConfig: input.includeConfig, compression: input.compression }, true));
  useBackupStore.getState().addBackup(backup);
  await waitForOperation(operation.id);
  const completed = (await listBackups(input.serverId)).find(b => b.id === backup.id);
  if (!completed) throw new Error("Backup metadata could not be loaded.");
  return completed;
}
function path(id: string) { const backup = useBackupStore.getState().backups.find(b => b.id === id); if (!backup) throw new Error("Backup not found. Refresh the page."); return `/servers/${backup.serverId}/backups/${id}`; }
export async function restoreBackup(id: string) { const { operation } = await api<{ operation: OperationDto }>(`${path(id)}/restore`, mutation("POST")); await waitForOperation(operation.id); }
export async function deleteBackup(id: string) { await api(path(id), mutation("DELETE")); useBackupStore.getState().removeBackup(id); }
