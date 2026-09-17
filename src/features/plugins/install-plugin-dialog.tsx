"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
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
import { INSTALL_MODRINTH_STEPS, installModrinthProject } from "@/services";
import { useServerStore } from "@/stores/use-server-store";
import { checkCompatibility } from "@/lib/modrinth-compat";
import { CompatibilityBadge } from "@/features/marketplace/compatibility-badge";
import { cn } from "@/lib/utils";

interface InstallPluginDialogProps {
  hit: ModrinthSearchHit | null;
  serverId: string;
  serverName: string;
  onOpenChange: (open: boolean) => void;
}

export function InstallPluginDialog({ hit, serverId, serverName, onOpenChange }: InstallPluginDialogProps) {
  const server = useServerStore((s) => s.servers.find((srv) => srv.id === serverId));
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const compat = useMemo(() => (hit && server ? checkCompatibility(hit, server) : null), [hit, server]);
  const installing = stepIndex !== null && !done;

  if (!hit) return null;

  async function handleInstall() {
    if (!hit) return;
    setStepIndex(0);
    setDone(false);
    try {
      await installModrinthProject(hit, serverId, (index) => setStepIndex(index));
      setDone(true);
      toast.success(`${hit.title} installed on ${serverName}`);
    } catch (e) {
      toast.error((e as Error).message);
      setStepIndex(null);
    }
  }

  function handleClose(open: boolean) {
    if (installing) return;
    onOpenChange(open);
    setStepIndex(null);
    setDone(false);
  }

  return (
    <Dialog open={Boolean(hit)} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install {hit.title}</DialogTitle>
          <DialogDescription>{hit.description}</DialogDescription>
        </DialogHeader>

        {stepIndex === null ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
              <span className="text-muted-foreground">Target Server</span>
              <span className="font-medium text-foreground">{serverName}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
              <span className="text-muted-foreground">Compatibility</span>
              {compat && <CompatibilityBadge level={compat.level} />}
            </div>
            {compat && compat.level !== "compatible" && (
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-xs",
                  compat.level === "incompatible"
                    ? "border-status-critical/30 bg-status-critical-muted text-status-critical"
                    : "border-status-warning/30 bg-status-warning-muted text-status-warning",
                )}
              >
                <p className="font-medium">{compat.level === "incompatible" ? "This may not work" : "Possible issue"}</p>
                <p className="text-foreground/80">{compat.reason}</p>
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
                disabled={installing}
                variant={compat && compat.level !== "compatible" ? "destructive" : "default"}
              >
                {installing ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                {compat && compat.level !== "compatible" ? "Install Anyway" : "Install"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
