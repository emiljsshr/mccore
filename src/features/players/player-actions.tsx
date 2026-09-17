"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  MessageSquare,
  UserX,
  ShieldBan,
  ShieldCheck,
  ListPlus,
  MoreHorizontal,
  Loader2,
} from "@/lib/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { BanPlayerDialog } from "@/features/players/ban-player-dialog";
import { MessagePlayerDialog } from "@/features/players/message-player-dialog";
import { useSessionStore } from "@/stores/use-session-store";
import { kickPlayer, toggleOperator, toggleWhitelist, unbanPlayer } from "@/services";
import type { Player } from "@/types";

interface PlayerActionsProps {
  player: Player;
}

/**
 * Fleet-wide per-row actions menu. Every mutating action here goes through
 * the same `player-service.ts` calls the per-server players page uses, which
 * resolve the target server from the player's *current* session
 * (`serverId`) — only set while the player is online (see the comment in
 * `GET /api/v1/players` for why offline players can't carry accurate
 * per-server ban/op/whitelist state). So every action below is disabled for
 * offline players, not just the ones the per-server drawer already disables.
 */
export function PlayerActions({ player }: PlayerActionsProps) {
  const user = useSessionStore((s) => s.user);
  const allowed = (permission: string) => Boolean(user?.isSuperAdmin || user?.permissions.includes(permission));
  const canMessage = allowed("console.execute");
  const canKick = allowed("players.kick");
  const canBan = allowed("players.ban");
  const canOp = allowed("players.op");
  const canWhitelist = allowed("players.whitelist");
  const hasAnyAction = canMessage || canKick || canBan || canOp || canWhitelist;

  const [isPending, startTransition] = useTransition();
  const [messageOpen, setMessageOpen] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const [confirmKick, setConfirmKick] = useState(false);
  const [confirmUnban, setConfirmUnban] = useState(false);

  const offline = !player.online;

  function run(fn: () => Promise<unknown>, successMessage: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(successMessage);
      } catch (e) {
        toast.error((e as Error).message || "Action failed. Please try again.");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={(e) => e.stopPropagation()}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
            <span className="sr-only">Player actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {!hasAnyAction ? (
            <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
          ) : (
            <>
              {offline && <DropdownMenuItem disabled>Player is offline</DropdownMenuItem>}
              {canMessage && (
                <DropdownMenuItem disabled={offline || isPending} onClick={() => setMessageOpen(true)}>
                  <MessageSquare /> Message
                </DropdownMenuItem>
              )}
              {canKick && (
                <DropdownMenuItem disabled={offline || isPending} onClick={() => setConfirmKick(true)}>
                  <UserX /> Kick
                </DropdownMenuItem>
              )}
              {canBan &&
                (player.banned ? (
                  <DropdownMenuItem disabled={offline || isPending} onClick={() => setConfirmUnban(true)}>
                    <ShieldCheck /> Unban
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled={offline || isPending} onClick={() => setBanOpen(true)}>
                    <ShieldBan /> Ban
                  </DropdownMenuItem>
                ))}
              {(canOp || canWhitelist) && <DropdownMenuSeparator />}
              {canOp && (
                <DropdownMenuItem
                  disabled={offline || isPending}
                  onClick={() =>
                    run(() => toggleOperator(player.id), player.operator ? "Operator revoked" : "Operator granted")
                  }
                >
                  <ShieldCheck /> {player.operator ? "Revoke Operator" : "Grant Operator"}
                </DropdownMenuItem>
              )}
              {canWhitelist && (
                <DropdownMenuItem
                  disabled={offline || isPending}
                  onClick={() =>
                    run(
                      () => toggleWhitelist(player.id),
                      player.whitelisted ? "Removed from whitelist" : "Added to whitelist",
                    )
                  }
                >
                  <ListPlus /> {player.whitelisted ? "Remove from Whitelist" : "Add to Whitelist"}
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmKick}
        onOpenChange={setConfirmKick}
        title={`Kick ${player.username}?`}
        description="They will be disconnected immediately and may rejoin at any time."
        confirmLabel="Kick Player"
        destructive
        onConfirm={() => run(() => kickPlayer(player.id), `${player.username} was kicked`)}
      />

      <ConfirmDialog
        open={confirmUnban}
        onOpenChange={setConfirmUnban}
        title={`Unban ${player.username}?`}
        description="This player will be able to join the server again."
        confirmLabel="Unban"
        onConfirm={() => run(() => unbanPlayer(player.id), `${player.username} was unbanned`)}
      />

      <BanPlayerDialog open={banOpen} onOpenChange={setBanOpen} playerId={player.id} username={player.username} />
      <MessagePlayerDialog
        open={messageOpen}
        onOpenChange={setMessageOpen}
        playerId={player.id}
        username={player.username}
      />
    </>
  );
}
