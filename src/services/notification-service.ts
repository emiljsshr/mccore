import type { AppNotification } from "@/types";
import { api, mutation } from "@/lib/api";
import { useNotificationStore } from "@/stores/use-notification-store";
export async function listNotifications(): Promise<AppNotification[]> { const { notifications } = await api<{ notifications: AppNotification[] }>("/notifications"); useNotificationStore.setState({ notifications }); return notifications; }
export async function markNotificationRead(id: string) { await api(`/notifications/${id}/read`, mutation("POST")); await listNotifications(); }
export async function markAllNotificationsRead() { await api("/notifications/read-all", mutation("POST")); await listNotifications(); }
