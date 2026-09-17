"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlayerAvatar } from "@/components/shared/player-avatar";
import { InventoryGrid } from "@/features/players/inventory-grid";
import { BanPlayerDialog } from "@/features/players/ban-player-dialog";
import { MessagePlayerDialog } from "@/features/players/message-player-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDateTime, formatPlaytime, formatRelativeTime } from "@/lib/format";
import type { GameMode, Player } from "@/types";
import {
  MessageSquare,
  Navigation,
  UserX,
  ShieldBan,
  ShieldCheck,
  ListPlus,
  Loader2,
} from "@/lib/icons";
import { kickPlayer, setGameMode, toggleOperator, toggleWhitelist, unbanPlayer } from "@/services";
import { Badge } from "@/components/ui/badge";

const GAME_MODES: GameMode[] = ["survival", "creative", "adventure", "spectator"];

interface PlayerDetailDrawerProps {
  player: Player | null;
  onOpenChange: (open: boolean) => void;
}

export function PlayerDetailDrawer({ player, onOpenChange }: PlayerDetailDrawerProps) {
  const [pending, setPending] = useState<string | null>(null);
  const [confirmKick, setConfirmKick] = useState(false);
  const [confirmBan, setConfirmBan] = useState(false);
  const [confirmUnban, setConfirmUnban] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);

  if (!player) return null;

  async function run(action: string, fn: () => Promise<void>, message: string) {
    setPending(action);
    try {
      await fn();
      toast.success(message);
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <Sheet open={Boolean(player)} onOpenChange={(open) => !open && onOpenChange(false)}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="sr-only">{player.username}</SheetTitle>
            <SheetDescription className="sr-only">Player details for {player.username}</SheetDescription>
            <div className="flex items-center gap-3">
              <PlayerAvatar seed={player.avatarSeed} size="xl" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-lg font-semibold text-foreground">{player.username}</h2>
                  {player.operator && <Badge variant="secondary">OP</Badge>}
                  {player.banned && <Badge variant="destructive">Banned</Badge>}
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">{player.uuid}</p>
                <p className="text-xs text-muted-foreground">
                  {player.online ? (
                    <span className="text-status-online">Online</span>
                  ) : (
                    <span>Last seen {formatRelativeTime(player.lastSeen)}</span>
                  )}
                </p>
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-4 px-4 pb-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Ping</p>
                <p className="font-medium text-foreground">{player.online ? `${player.ping} ms` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Playtime</p>
                <p className="font-medium text-foreground">{formatPlaytime(player.playtimeSeconds)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">First Joined</p>
                <p className="font-medium text-foreground">{formatDateTime(player.firstJoined)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Seen</p>
                <p className="font-medium text-foreground">{formatDateTime(player.lastSeen)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">World</p>
                <p className="font-medium text-foreground">{player.position?.world ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Coordinates</p>
                <p className="font-mono text-xs font-medium text-foreground">
                  {player.position
                    ? `${player.position.x.toFixed(1)}, ${player.position.y.toFixed(1)}, ${player.position.z.toFixed(1)}`
                    : "—"}
                </p>
              </div>
            </div>

            {player.banned && player.banReason && (
              <div className="rounded-lg border border-status-critical/30 bg-status-critical-muted p-3 text-sm">
                <p className="font-medium text-status-critical">Ban reason</p>
                <p className="mt-0.5 text-foreground/80">{player.banReason}</p>
                {player.bannedBy && (
                  <p className="mt-1 text-xs text-muted-foreground">Banned by {player.bannedBy}</p>
                )}
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Game Mode</p>
              <Select
                value={player.gameMode}
                disabled={!player.online || pending === "gamemode"}
                onValueChange={(value) =>
                  run("gamemode", () => setGameMode(player.id, value as GameMode), `Game mode set to ${value}`)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GAME_MODES.map((mode) => (
                    <SelectItem key={mode} value={mode} className="capitalize">
                      {mode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" disabled={!player.online} onClick={() => setMessageOpen(true)}>
                <MessageSquare className="size-3.5" /> Message
              </Button>
              <Button variant="outline" size="sm" disabled={!player.online}>
                <Navigation className="size-3.5" /> Teleport
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!player.online || pending === "kick"}
                onClick={() => setConfirmKick(true)}
              >
                {pending === "kick" ? <Loader2 className="size-3.5 animate-spin" /> : <UserX className="size-3.5" />}
                Kick
              </Button>
              {player.banned ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending === "unban"}
                  onClick={() => setConfirmUnban(true)}
                >
                  <ShieldCheck className="size-3.5" /> Unban
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setConfirmBan(true)}>
                  <ShieldBan className="size-3.5" /> Ban
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={pending === "op"}
                onClick={() =>
                  run("op", () => toggleOperator(player.id), player.operator ? "Operator revoked" : "Operator granted")
                }
              >
                {pending === "op" ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                {player.operator ? "De-OP" : "OP"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pending === "whitelist"}
                onClick={() =>
                  run(
                    "whitelist",
                    () => toggleWhitelist(player.id),
                    player.whitelisted ? "Removed from whitelist" : "Added to whitelist",
                  )
                }
              >
                <ListPlus className="size-3.5" /> {player.whitelisted ? "Un-whitelist" : "Whitelist"}
              </Button>
            </div>

            {player.inventory && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Inventory Preview
                  </p>
                  <InventoryGrid inventory={player.inventory} />
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmKick}
        onOpenChange={setConfirmKick}
        title={`Kick ${player.username}?`}
        description="They will be disconnected immediately and may rejoin at any time."
        confirmLabel="Kick Player"
        destructive
        onConfirm={() => run("kick", () => kickPlayer(player.id), `${player.username} was kicked`)}
      />

      <ConfirmDialog
        open={confirmUnban}
        onOpenChange={setConfirmUnban}
        title={`Unban ${player.username}?`}
        description="This player will be able to join the server again."
        confirmLabel="Unban"
        onConfirm={() => run("unban", () => unbanPlayer(player.id), `${player.username} was unbanned`)}
      />

      <BanPlayerDialog
        open={confirmBan}
        onOpenChange={setConfirmBan}
        playerId={player.id}
        username={player.username}
      />

      <MessagePlayerDialog
        open={messageOpen}
        onOpenChange={setMessageOpen}
        playerId={player.id}
        username={player.username}
      />
    </>
  );
}
