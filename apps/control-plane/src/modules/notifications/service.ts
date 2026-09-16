import type { Notification as NotificationRow } from "@mccore/database";
import type { NotificationDto } from "@mccore/contracts";

export function toNotificationDto(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    type: row.type.toLowerCase() as NotificationDto["type"],
    title: row.title,
    message: row.message,
    timestamp: row.createdAt.toISOString(),
    read: row.read,
    serverId: row.serverId ?? undefined,
  };
}
