export type NotificationType = "info" | "success" | "warning" | "critical";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  serverId?: string;
}
