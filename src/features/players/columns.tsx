"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Player } from "@/types";
import { PlayerAvatar } from "@/components/shared/player-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPlaytime, formatRelativeTime } from "@/lib/format";
import { ShieldBan, ShieldCheck, ListX } from "@/lib/icons";

function UsernameCell({ player }: { player: Player }) {
  return (
    <div className="flex items-center gap-2.5">
      <PlayerAvatar seed={player.avatarSeed} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{player.username}</p>
        {player.operator && (
          <Badge variant="secondary" className="h-4 px-1 text-[9px]">
            OP
          </Badge>
        )}
      </div>
    </div>
  );
}

export const onlinePlayerColumns: ColumnDef<Player>[] = [
  { id: "username", header: "Username", cell: ({ row }) => <UsernameCell player={row.original} /> },
  {
    id: "playtime",
    header: "Playtime",
    cell: ({ row }) => <span className="text-sm tabular-nums text-muted-foreground">{formatPlaytime(row.original.playtimeSeconds)}</span>,
  },
  {
    id: "ping",
    header: "Ping",
    cell: ({ row }) => <span className="text-sm tabular-nums text-muted-foreground">{row.original.ping} ms</span>,
  },
  {
    id: "world",
    header: "World",
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.position?.world ?? "—"}</span>,
  },
  {
    id: "position",
    header: "Position",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.position
          ? `${row.original.position.x.toFixed(0)}, ${row.original.position.y.toFixed(0)}, ${row.original.position.z.toFixed(0)}`
          : "—"}
      </span>
    ),
  },
  {
    id: "gameMode",
    header: "Game Mode",
    cell: ({ row }) => <span className="text-sm capitalize text-muted-foreground">{row.original.gameMode}</span>,
  },
];

export const allPlayersColumns: ColumnDef<Player>[] = [
  { id: "username", header: "Username", cell: ({ row }) => <UsernameCell player={row.original} /> },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) =>
      row.original.online ? (
        <Badge className="bg-status-online-muted text-status-online">Online</Badge>
      ) : (
        <Badge variant="secondary">Offline</Badge>
      ),
  },
  {
    id: "lastSeen",
    header: "Last Seen",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.online ? "Now" : formatRelativeTime(row.original.lastSeen)}
      </span>
    ),
  },
  {
    id: "playtime",
    header: "Playtime",
    cell: ({ row }) => <span className="text-sm tabular-nums text-muted-foreground">{formatPlaytime(row.original.playtimeSeconds)}</span>,
  },
  {
    id: "whitelisted",
    header: "Whitelisted",
    cell: ({ row }) => (row.original.whitelisted ? "Yes" : "—"),
  },
];

export function bannedPlayerColumns(onUnban: (player: Player) => void): ColumnDef<Player>[] {
  return [
    { id: "username", header: "Username", cell: ({ row }) => <UsernameCell player={row.original} /> },
    {
      id: "reason",
      header: "Ban Reason",
      cell: ({ row }) => (
        <span className="block max-w-md truncate text-sm text-muted-foreground">
          {row.original.banReason ?? "—"}
        </span>
      ),
    },
    {
      id: "bannedBy",
      header: "Banned By",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.bannedBy ?? "—"}</span>,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onUnban(row.original);
            }}
          >
            <ShieldCheck className="size-3.5" /> Unban
          </Button>
        </div>
      ),
    },
  ];
}

export function whitelistColumns(onRemove: (player: Player) => void): ColumnDef<Player>[] {
  return [
    { id: "username", header: "Username", cell: ({ row }) => <UsernameCell player={row.original} /> },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) =>
        row.original.online ? (
          <Badge className="bg-status-online-muted text-status-online">Online</Badge>
        ) : (
          <Badge variant="secondary">Offline</Badge>
        ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(row.original);
            }}
          >
            <ListX className="size-3.5" /> Remove
          </Button>
        </div>
      ),
    },
  ];
}

export function operatorColumns(onRevoke: (player: Player) => void): ColumnDef<Player>[] {
  return [
    { id: "username", header: "Username", cell: ({ row }) => <UsernameCell player={row.original} /> },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) =>
        row.original.online ? (
          <Badge className="bg-status-online-muted text-status-online">Online</Badge>
        ) : (
          <Badge variant="secondary">Offline</Badge>
        ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onRevoke(row.original);
            }}
          >
            <ShieldBan className="size-3.5" /> De-OP
          </Button>
        </div>
      ),
    },
  ];
}
