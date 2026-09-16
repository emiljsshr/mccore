"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { installedPluginColumns } from "@/features/plugins/installed-columns";
import { usePluginStore } from "@/stores/use-plugin-store";
import { deletePlugin, setPluginStatus, updatePlugin } from "@/services";
import type { InstalledPlugin } from "@/types";
import { PackageX } from "@/lib/icons";

export function PluginInstalledView({ serverId }: { serverId: string }) {
  const allPlugins = usePluginStore((s) => s.plugins);
  const plugins = useMemo(() => allPlugins.filter((p) => p.serverId === serverId), [allPlugins, serverId]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<InstalledPlugin | null>(null);

  async function handleToggle(plugin: InstalledPlugin) {
    setPendingId(plugin.id);
    try {
      await setPluginStatus(plugin.id, plugin.status === "enabled" ? "disabled" : "enabled");
      toast.success(`${plugin.name} ${plugin.status === "enabled" ? "disabled" : "enabled"}`);
    } finally {
      setPendingId(null);
    }
  }

  async function handleUpdate(plugin: InstalledPlugin) {
    setPendingId(plugin.id);
    try {
      await updatePlugin(plugin.id);
      toast.success(`${plugin.name} updated to ${plugin.latestVersion}`);
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    await deletePlugin(toDelete.id);
    toast.success(`${toDelete.name} removed`);
  }

  if (plugins.length === 0) {
    return (
      <EmptyState
        icon={PackageX}
        title="No plugins installed"
        description="Browse the Discover tab to find plugins for this server."
      />
    );
  }

  return (
    <>
      <DataTable
        columns={installedPluginColumns({
          onToggle: handleToggle,
          onUpdate: handleUpdate,
          onDelete: setToDelete,
          pendingId,
        })}
        data={plugins}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        description="This removes the plugin and its configuration from the server. This cannot be undone."
        confirmLabel="Delete Plugin"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
