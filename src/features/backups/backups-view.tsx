"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useBackupStore } from "@/stores/use-backup-store";
import { useServerStore } from "@/stores/use-server-store";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CreateBackupDialog } from "@/features/backups/create-backup-dialog";
import { deleteBackup, restoreBackup } from "@/services";
import { backupColumns } from "@/features/backups/columns";
import type { Backup } from "@/types";
import { Archive } from "@/lib/icons";

interface BackupsViewProps {
  serverId?: string;
}

export function BackupsView({ serverId }: BackupsViewProps) {
  const allBackups = useBackupStore((s) => s.backups);
  const servers = useServerStore((s) => s.servers);
  const backups = serverId ? allBackups.filter((b) => b.serverId === serverId) : allBackups;

  const [toRestore, setToRestore] = useState<Backup | null>(null);
  const [toDelete, setToDelete] = useState<Backup | null>(null);

  function serverName(id: string) {
    return servers.find((s) => s.id === id)?.name ?? id;
  }

  async function handleRestore() {
    if (!toRestore) return;
    await restoreBackup(toRestore.id);
    toast.success(`Restored from "${toRestore.name}"`);
  }

  async function handleDelete() {
    if (!toDelete) return;
    await deleteBackup(toDelete.id);
    toast.success("Backup deleted");
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateBackupDialog serverId={serverId ?? servers[0]?.id} />
      </div>

      {backups.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="No backups yet"
          description="Create your first backup to protect this server's data."
        />
      ) : (
        <DataTable
          columns={backupColumns({
            showServer: !serverId,
            serverName,
            onRestore: setToRestore,
            onDelete: setToDelete,
          })}
          data={backups}
        />
      )}

      <ConfirmDialog
        open={Boolean(toRestore)}
        onOpenChange={(open) => !open && setToRestore(null)}
        title={`Restore "${toRestore?.name}"?`}
        description="This overwrites the current server data with the contents of this backup. The server should be stopped before restoring."
        confirmLabel="Restore Backup"
        destructive
        onConfirm={handleRestore}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Delete "${toDelete?.name}"?`}
        description="This permanently removes the backup file. This cannot be undone."
        confirmLabel="Delete Backup"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
