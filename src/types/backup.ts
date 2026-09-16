export type BackupType = "automatic" | "manual";
export type BackupStatus = "completed" | "in_progress" | "failed";

export interface Backup {
  id: string;
  serverId: string;
  name: string;
  createdAt: string;
  sizeMb: number;
  type: BackupType;
  status: BackupStatus;
  location: string;
  includesWorlds: boolean;
  includesPlugins: boolean;
  includesConfig: boolean;
  compression: "none" | "fast" | "best";
}
