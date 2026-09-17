"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { InstalledPlugin } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Power, PowerOff, RefreshCw, Trash2, MoreHorizontal, Loader2 } from "@/lib/icons";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<InstalledPlugin["status"], { label: string; className: string }> = {
  enabled: { label: "Enabled", className: "bg-status-online-muted text-status-online" },
  disabled: { label: "Disabled", className: "bg-status-unknown-muted text-status-unknown" },
  error: { label: "Error", className: "bg-status-critical-muted text-status-critical" },
};

interface Actions {
  onToggle: (plugin: InstalledPlugin) => void;
  onUpdate: (plugin: InstalledPlugin) => void;
  onDelete: (plugin: InstalledPlugin) => void;
  pendingId: string | null;
}

export function installedPluginColumns({ onToggle, onUpdate, onDelete, pendingId }: Actions): ColumnDef<InstalledPlugin>[] {
  return [
    {
      id: "name",
      header: "Plugin",
      cell: ({ row }) => {
        const plugin = row.original;
        return (
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
              {plugin.iconLetter}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{plugin.name}</p>
              <p className="truncate text-xs text-muted-foreground">{plugin.description}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "version",
      header: "Version",
      cell: ({ row }) => <span className="text-sm tabular-nums text-muted-foreground">{row.original.version}</span>,
    },
    {
      accessorKey: "author",
      header: "Author",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.author}</span>,
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
      id: "update",
      header: "Update",
      cell: ({ row }) =>
        row.original.updateAvailable ? (
          <span className="text-xs font-medium text-status-info">v{row.original.latestVersion} available</span>
        ) : (
          <span className="text-xs text-muted-foreground">Up to date</span>
        ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const plugin = row.original;
        const isPending = pendingId === plugin.id;
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" onClick={(e) => e.stopPropagation()}>
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => onToggle(plugin)}>
                  {plugin.status === "enabled" ? (
                    <>
                      <PowerOff /> Disable
                    </>
                  ) : (
                    <>
                      <Power /> Enable
                    </>
                  )}
                </DropdownMenuItem>
                {plugin.updateAvailable && (
                  <DropdownMenuItem onClick={() => onUpdate(plugin)}>
                    <RefreshCw /> Update
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(plugin)}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
