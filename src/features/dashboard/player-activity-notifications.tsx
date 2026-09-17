"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { subscribeLive } from "@/lib/live";
import { playNotificationSound } from "@/lib/notification-sound";
import { PlayerAvatar } from "@/components/shared/player-avatar";
import { useServerStore } from "@/stores/use-server-store";
import { DoorEnter, DoorExit, Trophy } from "@/lib/icons";
import { cn } from "@/lib/utils";

type Tone = "join" | "leave" | "achievement";

const TONE_VISUALS: Record<Tone, { icon: typeof DoorEnter; className: string }> = {
  join: { icon: DoorEnter, className: "text-status-online" },
  leave: { icon: DoorExit, className: "text-muted-foreground" },
  achievement: { icon: Trophy, className: "text-status-warning" },
};

function ActivityToast({ username, message, tone }: { username: string; message: string; tone: Tone }) {
  const visual = TONE_VISUALS[tone];
  const Icon = visual.icon;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-lg">
      <PlayerAvatar seed={username} size="md" square={false} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{username}</p>
        <p className="truncate text-xs text-muted-foreground">{message}</p>
      </div>
      <Icon className={cn("size-4 shrink-0", visual.className)} />
    </div>
  );
}

/**
 * Live "X joined/left the server" and "X earned an achievement" toasts,
 * with sound — driven by the player.join/player.leave/player.achievement
 * events every server already broadcasts on its own `server:<id>` live
 * channel (see event-dispatcher.ts). Mounted only on the Dashboard, so it
 * subscribes to every server the session can see for as long as that page
 * is open, rather than app-wide.
 */
export function PlayerActivityNotifications() {
  const serverIds = useServerStore((s) => s.servers.map((server) => server.id)).join(",");

  useEffect(() => {
    const ids = serverIds.split(",").filter(Boolean);
    const unsubscribes = ids.map((id) =>
      subscribeLive(`server:${id}`, (event) => {
        if (event.type === "player.join") {
          const payload = event.payload as { username: string };
          playNotificationSound();
          toast.custom(() => (
            <ActivityToast username={payload.username} message="Joined the server" tone="join" />
          ));
        } else if (event.type === "player.leave") {
          const payload = event.payload as { username: string };
          playNotificationSound();
          toast.custom(() => (
            <ActivityToast username={payload.username} message="Left the server" tone="leave" />
          ));
        } else if (event.type === "player.achievement") {
          const payload = event.payload as { username: string; title: string };
          playNotificationSound();
          toast.custom(() => (
            <ActivityToast username={payload.username} message={`Earned "${payload.title}"`} tone="achievement" />
          ));
        }
      }),
    );
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [serverIds]);

  return null;
}
