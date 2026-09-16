export type AuditSeverity = "info" | "success" | "warning" | "critical";

export interface AuditEvent {
  id: string;
  actor: {
    id: string;
    name: string;
    avatarSeed: string;
    isSystem: boolean;
  };
  action: string;
  description: string;
  targetType?: "server" | "player" | "plugin" | "backup" | "node" | "user" | "file" | "world";
  targetLabel?: string;
  serverId?: string;
  severity: AuditSeverity;
  timestamp: string;
}
