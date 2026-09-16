import { create } from "zustand";
import type { AppNotification } from "@/types";

interface NotificationStore {
  notifications: AppNotification[];
  unreadCount: () => number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  add: (notification: AppNotification) => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: () => get().notifications.filter((n) => !n.read).length,
  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),
  markAllRead: () =>
    set((state) => ({ notifications: state.notifications.map((n) => ({ ...n, read: true })) })),
  add: (notification) =>
    set((state) => ({ notifications: [notification, ...state.notifications] })),
}));
