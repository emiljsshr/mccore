"use client";

import { Bell, CheckCheck, CircleAlert, CircleCheck, Info, TriangleAlert } from "@/lib/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useNotificationStore } from "@/stores/use-notification-store";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NotificationType } from "@/types";
import Link from "next/link";

const TYPE_CONFIG: Record<NotificationType, { icon: typeof Info; className: string }> = {
  info: { icon: Info, className: "text-status-info" },
  success: { icon: CircleCheck, className: "text-status-online" },
  warning: { icon: TriangleAlert, className: "text-status-warning" },
  critical: { icon: CircleAlert, className: "text-status-critical" },
};

export function NotificationCenter() {
  const notifications = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="p-3 relative border border-border rounded-full text-foreground transition-colors hover:bg-hover hover:text-foreground">
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute right-3 top-2.5 size-1.5 rounded-full bg-status-online" />
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-sm font-medium">Notifications</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => markAllRead()}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="size-3.5" />
              Mark all read
            </button>
          )}
        </div>
        <Separator />
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            notifications.map((n) => {
              const config = TYPE_CONFIG[n.type];
              const Icon = config.icon;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => markRead(n.id)}
                  className={cn(
                    "flex w-full items-start gap-2.5 border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-hover",
                    !n.read && "bg-muted/40",
                  )}
                >
                  <Icon className={cn("mt-0.5 size-4 shrink-0", config.className)} />
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-foreground">{n.title}</span>
                      {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                    </span>
                    <span className="block text-xs text-muted-foreground">{n.message}</span>
                    <span className="block text-[11px] text-muted-foreground/70">
                      {formatRelativeTime(n.timestamp)}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
        <Separator />
        <Link
          href="/activity"
          className="block px-3 py-2.5 text-center text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          View all activity
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
