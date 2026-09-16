"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { usePluginStore } from "@/stores/use-plugin-store";
import { updatePlugin } from "@/services";
import { CircleCheck, Loader2, RefreshCw } from "@/lib/icons";

export function PluginUpdatesView() {
  const plugins = usePluginStore((s) => s.plugins);
  const outdated = plugins.filter((p) => p.updateAvailable);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleUpdate(id: string, name: string) {
    setPendingId(id);
    try {
      await updatePlugin(id);
      toast.success(`${name} updated`);
    } finally {
      setPendingId(null);
    }
  }

  async function handleUpdateAll() {
    for (const plugin of outdated) {
      await handleUpdate(plugin.id, plugin.name);
    }
  }

  if (outdated.length === 0) {
    return (
      <EmptyState
        icon={CircleCheck}
        title="Everything is up to date"
        description="All installed plugins are running their latest version."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={handleUpdateAll}>
          <RefreshCw className="size-3.5" /> Update all
        </Button>
      </div>
      <div className="divide-y divide-border rounded-xl border border-border bg-surface">
        {outdated.map((plugin) => (
          <div key={plugin.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                {plugin.iconLetter}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{plugin.name}</p>
                <p className="text-xs text-muted-foreground">
                  {plugin.version} → <span className="font-medium text-status-info">{plugin.latestVersion}</span>
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={pendingId === plugin.id}
              onClick={() => handleUpdate(plugin.id, plugin.name)}
            >
              {pendingId === plugin.id ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Update
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
