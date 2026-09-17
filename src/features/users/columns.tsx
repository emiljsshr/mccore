"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { PlatformUser } from "@/types";
import { PlayerAvatar } from "@/components/shared/player-avatar";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { UserActions } from "@/features/users/user-actions";

export const ROLE_LABEL: Record<PlatformUser["role"], string> = {
  owner: "Owner",
  administrator: "Administrator",
  developer: "Developer",
  moderator: "Moderator",
  viewer: "Viewer",
};

export const STATUS_CONFIG: Record<PlatformUser["status"], { label: string; className: string }> = {
  active: { label: "Active", className: "bg-status-online-muted text-status-online" },
  invited: { label: "Invited", className: "bg-status-info-muted text-status-info" },
  suspended: { label: "Suspended", className: "bg-status-critical-muted text-status-critical" },
};

export const userColumns: ColumnDef<PlatformUser>[] = [
  {
    id: "name",
    header: "Name",
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="flex items-center gap-2.5">
          <PlayerAvatar seed={user.avatarSeed} size="sm" square={false} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => <Badge variant="secondary">{ROLE_LABEL[row.original.role]}</Badge>,
  },
  {
    id: "servers",
    header: "Servers",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.serverIds.length === 0 ? "—" : row.original.serverIds.length}
      </span>
    ),
  },
  {
    accessorKey: "lastActive",
    header: "Last Active",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{formatRelativeTime(row.original.lastActive)}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const config = STATUS_CONFIG[row.original.status];
      return <Badge className={cn(config.className)}>{config.label}</Badge>;
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <div className="flex justify-end">
        <UserActions user={row.original} />
      </div>
    ),
  },
];
