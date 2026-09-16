"use client";
import { toast } from "sonner";


import { useState } from "react";
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
import type { MarketplacePlugin } from "@/types";
import { INSTALL_PLUGIN_STEPS, installPlugin } from "@/services";
import { cn } from "@/lib/utils";

interface InstallPluginDialogProps {
  plugin: MarketplacePlugin | null;
  serverId: string;
  serverName: string;
  onOpenChange: (open: boolean) => void;
  onInstalled?: () => void;
}

const DEPENDENCIES: Record<string, string[]> = {
  "mp-fastasyncworldedit": ["WorldEdit"],
  "mp-townyadvanced": ["Vault"],
  "mp-deluxemenus": ["PlaceholderAPI"],
};

export function InstallPluginDialog({
  plugin,
  serverId,
  serverName,
  onOpenChange,
  onInstalled,
}: InstallPluginDialogProps) {
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  if (!plugin) return null;

  const dependencies = DEPENDENCIES[plugin.id] ?? [];
  const installing = stepIndex !== null && !done;

  async function handleInstall() {
    if (!plugin) return;
    setStepIndex(0);
    setDone(false);
    try {
    await installPlugin(plugin, serverId, (index) => setStepIndex(index));
    setDone(true);
    onInstalled?.();
    } catch(e) { toast.error((e as Error).message); setStepIndex(null); }
  }

  function handleClose(open: boolean) {
    if (installing) return;
    onOpenChange(open);
    setStepIndex(null);
    setDone(false);
  }

  return (
    <Dialog open={Boolean(plugin)} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install {plugin.name}</DialogTitle>
          <DialogDescription>{plugin.description}</DialogDescription>
        </DialogHeader>

        {stepIndex === null ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
              <span className="text-muted-foreground">Plugin</span>
              <span className="font-medium text-foreground">{plugin.name}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
              <span className="text-muted-foreground">Version</span>
              <span className="font-medium text-foreground">{plugin.supportedVersions[0]}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
              <span className="text-muted-foreground">Target Server</span>
              <span className="font-medium text-foreground">{serverName}</span>
            </div>
            {dependencies.length > 0 && (
              <div className="rounded-md border border-status-warning/30 bg-status-warning-muted px-3 py-2">
                <p className="font-medium text-status-warning">Requires dependencies</p>
                <p className="text-foreground/80">{dependencies.join(", ")}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {INSTALL_PLUGIN_STEPS.map((step, index) => {
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
            <Progress value={done ? 100 : ((stepIndex + 1) / INSTALL_PLUGIN_STEPS.length) * 100} />
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
              <Button onClick={handleInstall} disabled={installing}>
                {installing ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Install
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
