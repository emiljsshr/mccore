"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { X, PackageCheck, Loader2 } from "@/lib/icons";
import { usePluginStore } from "@/stores/use-plugin-store";
import { updatePlugin } from "@/services";
import { Button } from "@/components/ui/button";

export function PluginUpdatesCard() {
  const plugins = usePluginStore((s) => s.plugins);
  const outdated = useMemo(() => plugins.filter((p) => p.updateAvailable).slice(0, 3), [plugins]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  async function handleUpdate(id: string, name: string) {
    setPendingId(id);
    try {
      await updatePlugin(id);
      toast.success(`${name} updated`);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Plugin Updates</h2>
          {outdated.length > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-status-warning-muted text-[10px] font-semibold text-status-warning">
              {outdated.length}
            </span>
          )}
        </div>
        <Link href="/servers/srv-survival/plugins" className="text-xs font-medium text-primary hover:underline">
          View All
        </Link>
      </div>

      <div className="flex-1 space-y-3">
        {outdated.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">All plugins are up to date.</p>
        ) : (
          outdated.map((plugin) => (
            <div key={plugin.id} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                  {plugin.iconLetter}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{plugin.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {plugin.version} <span className="text-status-online">→ {plugin.latestVersion}</span>
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 shrink-0 text-xs"
                disabled={pendingId === plugin.id}
                onClick={() => handleUpdate(plugin.id, plugin.name)}
              >
                {pendingId === plugin.id ? <Loader2 className="size-3 animate-spin" /> : "Update"}
              </Button>
            </div>
          ))
        )}
      </div>

      {!dismissed && (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-status-online-muted p-3">
          <PackageCheck className="mt-0.5 size-4 shrink-0 text-status-online" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground">Keep your plugins up to date</p>
            <p className="text-xs text-muted-foreground">Automatic update checks keep your servers secure.</p>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
