"use client";
import Link from "next/link";
import { useDataStore } from "@/stores/use-data-store";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  UserPlus,
  RefreshCw,
  RotateCw,
  Archive,
  Ban,
  Server,
  type LucideIcon,
} from "@/lib/icons";

const ACTION_ICON: Record<string, { icon: LucideIcon; className: string }> = {
  "player.join": { icon: UserPlus, className: "bg-status-online-muted text-status-online" },
  "plugin.update": { icon: RefreshCw, className: "bg-status-info-muted text-status-info" },
  "plugin.install": { icon: RefreshCw, className: "bg-status-info-muted text-status-info" },
  "server.restart": { icon: RotateCw, className: "bg-status-warning-muted text-status-warning" },
  "backup.completed": { icon: Archive, className: "bg-status-online-muted text-status-online" },
  "backup.failed": { icon: Archive, className: "bg-status-critical-muted text-status-critical" },
  "player.ban": { icon: Ban, className: "bg-status-critical-muted text-status-critical" },
  "player.kick": { icon: Ban, className: "bg-status-warning-muted text-status-warning" },
  "node.connected": { icon: Server, className: "bg-status-online-muted text-status-online" },
  "user.invite": { icon: UserPlus, className: "bg-status-info-muted text-status-info" },
  "file.edit": { icon: RefreshCw, className: "bg-status-unknown-muted text-status-unknown" },
  "world.backup": { icon: Archive, className: "bg-status-online-muted text-status-online" },
};

const DEFAULT_ICON = { icon: RefreshCw, className: "bg-status-unknown-muted text-status-unknown" };

export function RecentActivity() {
  const mockActivity = useDataStore(s => s.activity);
  const events = mockActivity.slice(0, 6);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
        <Link href="/activity" className="text-xs font-medium text-primary hover:underline">
          View All
        </Link>
      </div>
      <div className="space-y-3.5">
        {events.map((event) => {
          const config = ACTION_ICON[event.action] ?? DEFAULT_ICON;
          const Icon = config.icon;
          return (
            <div key={event.id} className="flex items-start gap-3">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  config.className,
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-foreground">{event.description}</p>
              </div>
              <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                {formatRelativeTime(event.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
