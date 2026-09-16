"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Backup } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatBytesFromMb, formatDateTime } from "@/lib/format";
import { RotateCcw, Download, Trash2, MoreHorizontal, Loader2 } from "@/lib/icons";
import { toast } from "sonner";

const STATUS_CONFIG: Record<Backup["status"], { label: string; className: string }> = {
  completed: { label: "Completed", className: "bg-status-online-muted text-status-online" },
  in_progress: { label: "In Progress", className: "bg-status-info-muted text-status-info" },
  failed: { label: "Failed", className: "bg-status-critical-muted text-status-critical" },
};

interface BackupColumnsOptions {
  showServer: boolean;
  serverName: (id: string) => string;
  onRestore: (backup: Backup) => void;
  onDelete: (backup: Backup) => void;
}

export function backupColumns({ showServer, serverName, onRestore, onDelete }: BackupColumnsOptions): ColumnDef<Backup>[] {
  const columns: ColumnDef<Backup>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium text-foreground">{row.original.name}</p>
          <p className="text-xs capitalize text-muted-foreground">{row.original.type}</p>
        </div>
      ),
    },
  ];

  if (showServer) {
    columns.push({
      id: "server",
      header: "Server",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{serverName(row.original.serverId)}</span>,
    });
  }

  columns.push(
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDateTime(row.original.createdAt)}</span>,
    },
    {
      accessorKey: "sizeMb",
      header: "Size",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {row.original.status === "in_progress" ? "—" : formatBytesFromMb(row.original.sizeMb)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const config = STATUS_CONFIG[row.original.status];
        return (
          <Badge className={config.className}>
            {row.original.status === "in_progress" && <Loader2 className="size-3 animate-spin" />}
            {config.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "location",
      header: "Location",
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.location}</span>,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const backup = row.original;
        const disabled = backup.status !== "completed";
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={disabled} onClick={() => onRestore(backup)}>
                  <RotateCcw /> Restore
                </DropdownMenuItem>
                <DropdownMenuItem disabled={disabled} onClick={() => toast.info("Download (demo)")}>
                  <Download /> Download
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(backup)}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  );

  return columns;
}
