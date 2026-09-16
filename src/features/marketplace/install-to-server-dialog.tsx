"use client";
"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CircleCheck, Download, Loader2, PackageCheck } from "@/lib/icons";
import type { ModrinthSearchHit } from "@/types";
import { SERVER_SOFTWARE_LABEL } from "@/types";
import { INSTALL_MODRINTH_STEPS, installModrinthProject } from "@/services";
import { useServerStore } from "@/stores/use-server-store";
import { usePluginStore } from "@/stores/use-plugin-store";
import { checkCompatibility } from "@/lib/modrinth-compat";
import { CompatibilityBadge } from "@/features/marketplace/compatibility-badge";
import { ServerBlockIcon } from "@/components/shared/server-block-icon";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface InstallToServerDialogProps {
  hit: ModrinthSearchHit | null;
  onOpenChange: (open: boolean) => void;
}

export function InstallToServerDialog({ hit, onOpenChange }: InstallToServerDialogProps) {
  const servers = useServerStore((s) => s.servers);
  const installedPlugins = usePluginStore((s) => s.plugins);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const rows = useMemo(() => {
    if (!hit) return [];
    return servers.map((server) => ({
      server,
      compat: checkCompatibility(hit, server),
      alreadyInstalled: installedPlugins.some((p) => p.serverId === server.id && p.name === hit.title),
    }));
  }, [hit, servers, installedPlugins]);

  const selected = rows.find((r) => r.server.id === selectedServerId) ?? null;
  const installing = stepIndex !== null && !done;

  if (!hit) return null;

  async function handleInstall() {
    if (!hit || !selectedServerId) return;
    setStepIndex(0);
    setDone(false);
    try {
    await installModrinthProject(hit, selectedServerId, (index) => setStepIndex(index));
    setDone(true);
    toast.success(`${hit.title} installed on ${selected?.server.name}`);
    } catch(e) { toast.error((e as Error).message); setStepIndex(null); }
  }

  function handleClose(open: boolean) {
    if (installing) return;
    onOpenChange(open);
    setStepIndex(null);
    setDone(false);
    setSelectedServerId(null);
  }

  return (
    <Dialog open={Boolean(hit)} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Install {hit.title}</DialogTitle>
          <DialogDescription>Choose which server to install this on.</DialogDescription>
        </DialogHeader>

        {stepIndex === null ? (
          <div className="space-y-3">
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {rows.map(({ server, compat, alreadyInstalled }) => (
                <button
                  key={server.id}
                  type="button"
                  disabled={alreadyInstalled}
                  onClick={() => setSelectedServerId(server.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                    alreadyInstalled
                      ? "cursor-not-allowed border-border/60 opacity-50"
                      : selectedServerId === server.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-hover",
                  )}
                >
                  <ServerBlockIcon serverId={server.id} icon={server.icon} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{server.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {SERVER_SOFTWARE_LABEL[server.software]} · {server.minecraftVersion}
                    </span>
                  </span>
                  {alreadyInstalled ? (
                    <span className="shrink-0 text-[11px] font-medium text-muted-foreground">Installed</span>
                  ) : (
                    <CompatibilityBadge level={compat.level} />
                  )}
                </button>
              ))}
            </div>

            {selected && selected.compat.level !== "compatible" && (
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-xs",
                  selected.compat.level === "incompatible"
                    ? "border-status-critical/30 bg-status-critical-muted text-status-critical"
                    : "border-status-warning/30 bg-status-warning-muted text-status-warning",
                )}
              >
                <p className="font-medium">
                  {selected.compat.level === "incompatible" ? "This may not work" : "Possible issue"}
                </p>
                <p className="text-foreground/80">{selected.compat.reason}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {INSTALL_MODRINTH_STEPS.map((step, index) => {
              const isCurrent = index === stepIndex && !done;
              const isComplete = index < stepIndex || done;
              return (
                <div key={step} className="flex items-center gap-3 text-sm">
                  {isComplete ? (
                    <CircleCheck className="size-4 text-status-online" />
                  ) : isCurrent ? (
                    <Loader2 className="size-4 animate-spin text-status-info" />
                  ) : (
                    <div className="size-4 rounded-full border border-border" />
                  )}
                  <span className={cn(isComplete ? "text-foreground" : "text-muted-foreground")}>{step}</span>
                </div>
              );
            })}
            {done && (
              <div className="flex items-center gap-2 rounded-md border border-status-warning/30 bg-status-warning-muted px-3 py-2 text-sm text-status-warning">
                <PackageCheck className="size-4" />
                Restart the server for changes to take effect.
              </div>
            )}
            <Progress value={done ? 100 : ((stepIndex + 1) / INSTALL_MODRINTH_STEPS.length) * 100} />
          </div>
        )}

        <DialogFooter>
          {done ? (
            <Button onClick={() => handleClose(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={installing}>
                Cancel
              </Button>
              <Button
                onClick={handleInstall}
                disabled={installing || !selected || selected.alreadyInstalled}
                variant={selected && selected.compat.level !== "compatible" ? "destructive" : "default"}
              >
                {installing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {selected && selected.compat.level !== "compatible" ? "Install Anyway" : "Install"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
