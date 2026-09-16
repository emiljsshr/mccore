"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import type { Server } from "@/types";
import { SERVER_SOFTWARE_LABEL } from "@/types";
import { ServerStatusBadge } from "@/components/shared/server-status-badge";
import { ServerBlockIcon } from "@/components/shared/server-block-icon";
import { SoftwareIcon } from "@/components/shared/software-icon";
import { ServerActions } from "@/components/shared/server-actions";
import { formatMemory, formatUptime } from "@/lib/format";
import { Users } from "@/lib/icons";

export const serverColumns: ColumnDef<Server>[] = [
  {
    accessorKey: "name",
    header: "Server",
    cell: ({ row }) => {
      const server = row.original;
      return (
        <Link
          href={`/servers/${server.id}`}
          className="flex items-center gap-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          <ServerBlockIcon serverId={server.id} icon={server.icon} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{server.name}</p>
            {server.description && (
              <p className="hidden max-w-[220px] truncate text-xs text-muted-foreground lg:block">
                {server.description}
              </p>
            )}
          </div>
        </Link>
      );
    },
  },
  {
    accessorKey: "software",
    header: "Software",
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <SoftwareIcon software={row.original.software} />
        {SERVER_SOFTWARE_LABEL[row.original.software]}
      </div>
    ),
  },
  {
    accessorKey: "minecraftVersion",
    header: "Version",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.minecraftVersion}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <ServerStatusBadge status={row.original.status} />,
  },
  {
    id: "players",
    header: "Players",
    accessorFn: (row) => row.players.online,
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5 text-sm tabular-nums text-foreground">
        <Users className="size-3.5 text-muted-foreground" />
        {row.original.players.online}/{row.original.players.max}
      </div>
    ),
  },
  {
    id: "cpu",
    header: "CPU",
    accessorFn: (row) => row.resources.cpuPercent,
    cell: ({ row }) => (
      <span className="text-sm tabular-nums text-muted-foreground">
        {row.original.status === "online" ? `${row.original.resources.cpuPercent}%` : "—"}
      </span>
    ),
  },
  {
    id: "memory",
    header: "Memory",
    accessorFn: (row) => row.resources.memoryUsedMb,
    cell: ({ row }) => (
      <span className="text-sm tabular-nums text-muted-foreground">
        {formatMemory(row.original.resources.memoryUsedMb, row.original.resources.memoryMaxMb)}
      </span>
    ),
  },
  {
    id: "tps",
    header: "TPS",
    accessorFn: (row) => row.performance.tps,
    cell: ({ row }) => (
      <span className="text-sm tabular-nums text-muted-foreground">
        {row.original.status === "online" ? row.original.performance.tps.toFixed(2) : "—"}
      </span>
    ),
  },
  {
    accessorKey: "nodeId",
    header: "Node",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.nodeId}</span>
    ),
  },
  {
    id: "uptime",
    header: "Uptime",
    accessorFn: (row) => row.uptimeSeconds,
    cell: ({ row }) => (
      <span className="text-sm tabular-nums text-muted-foreground">
        {formatUptime(row.original.uptimeSeconds)}
      </span>
    ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <div className="flex justify-end">
        <ServerActions server={row.original} />
      </div>
    ),
  },
];
