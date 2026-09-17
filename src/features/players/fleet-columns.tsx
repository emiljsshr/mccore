"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import type { Player } from "@/types";
import { PlayerAvatar } from "@/components/shared/player-avatar";
import { PlayerActions } from "@/features/players/player-actions";
import { Badge } from "@/components/ui/badge";
import { useServerStore } from "@/stores/use-server-store";
import { formatPlaytime, formatRelativeTime } from "@/lib/format";

function UsernameCell({ player }: { player: Player }) {
  return (
    <div className="flex items-center gap-2.5">
      <PlayerAvatar seed={player.avatarSeed} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{player.username}</p>
        <p className="truncate font-mono text-[10px] text-muted-foreground">{player.uuid}</p>
      </div>
    </div>
  );
}

// Only set while the player has an open session (see GET /api/v1/players) —
// offline players show no current server.
function ServerCell({ serverId }: { serverId?: string }) {
  const server = useServerStore((s) => (serverId ? s.servers.find((sv) => sv.id === serverId) : undefined));
  if (!server) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <Link
      href={`/servers/${server.id}`}
      onClick={(e) => e.stopPropagation()}
      className="text-sm font-medium text-foreground hover:underline"
    >
      {server.name}
    </Link>
  );
}

function FlagsCell({ player }: { player: Player }) {
  if (!player.banned && !player.operator && !player.whitelisted) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {player.banned && <Badge variant="destructive">Banned</Badge>}
      {player.operator && <Badge variant="secondary">OP</Badge>}
      {player.whitelisted && <Badge variant="outline">Whitelisted</Badge>}
    </div>
  );
}

export const fleetPlayerColumns: ColumnDef<Player>[] = [
  { id: "username", header: "Player", cell: ({ row }) => <UsernameCell player={row.original} /> },
  {
    id: "server",
    header: "Server",
    cell: ({ row }) => <ServerCell serverId={row.original.serverId} />,
  },
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
    cell: ({ row }) => (
      <span className="text-sm tabular-nums text-muted-foreground">
        {formatPlaytime(row.original.playtimeSeconds)}
      </span>
    ),
  },
  {
    id: "flags",
    header: "Flags",
    cell: ({ row }) => <FlagsCell player={row.original} />,
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <div className="flex justify-end">
        <PlayerActions player={row.original} />
      </div>
    ),
  },
];
