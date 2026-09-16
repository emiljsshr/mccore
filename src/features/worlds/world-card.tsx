"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { World } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatBytesFromMb, formatRelativeTime } from "@/lib/format";
import { Download, Archive, Copy, RotateCcw, Trash2, Loader2, Globe } from "@/lib/icons";
import { backupWorld, deleteWorld, resetWorld } from "@/services";
import { cn } from "@/lib/utils";

const ENV_LABEL: Record<World["environment"], string> = {
  overworld: "Overworld",
  nether: "Nether",
  the_end: "The End",
};

const ENV_COLOR: Record<World["environment"], string> = {
  overworld: "bg-status-online-muted text-status-online",
  nether: "bg-status-critical-muted text-status-critical",
  the_end: "bg-violet-500/15 text-violet-500",
};

export function WorldCard({ world, onRemoved }: { world: World; onRemoved: (id: string) => void }) {
  const [pending, setPending] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleBackup() {
    setPending("backup");
    try {
      await backupWorld(world.id);
      toast.success(`Backup created for ${world.name}`);
    } finally {
      setPending(null);
    }
  }

  async function handleReset() {
    setPending("reset");
    try {
      await resetWorld(world.id);
      toast.success(`${world.name} was reset`);
    } finally {
      setPending(null);
    }
  }

  async function handleDelete() {
    await deleteWorld(world.id);
    onRemoved(world.id);
    toast.success(`${world.name} deleted`);
  }

  return (
    <Card className="gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-muted-foreground" />
          <span className="font-medium text-foreground">{world.name}</span>
        </div>
        <Badge className={cn(ENV_COLOR[world.environment])}>{ENV_LABEL[world.environment]}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <span className="text-muted-foreground">Size</span>
        <span className="text-right font-medium text-foreground">{formatBytesFromMb(world.sizeMb)}</span>
        <span className="text-muted-foreground">Seed</span>
        <span className="truncate text-right font-mono font-medium text-foreground" title={world.seed}>
          {world.seed}
        </span>
        <span className="text-muted-foreground">Difficulty</span>
        <span className="text-right font-medium capitalize text-foreground">{world.difficulty}</span>
        <span className="text-muted-foreground">Game Mode</span>
        <span className="text-right font-medium capitalize text-foreground">{world.gameMode}</span>
        <span className="text-muted-foreground">Last Backup</span>
        <span className="text-right font-medium text-foreground">
          {world.lastBackup ? formatRelativeTime(world.lastBackup) : "Never"}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
        <Button variant="outline" size="sm" onClick={() => toast.info("Download (demo)")}>
          <Download className="size-3.5" /> Download
        </Button>
        <Button variant="outline" size="sm" onClick={handleBackup} disabled={pending === "backup"}>
          {pending === "backup" ? <Loader2 className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />}
          Backup
        </Button>
        <Button variant="outline" size="sm" onClick={() => toast.info("Duplicate (demo)")}>
          <Copy className="size-3.5" /> Duplicate
        </Button>
        <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)} disabled={pending === "reset"}>
          <RotateCcw className="size-3.5" /> Reset
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-status-critical hover:bg-status-critical-muted hover:text-status-critical"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="size-3.5" /> Delete
        </Button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={`Reset ${world.name}?`}
        description="All terrain, structures and player changes in this world will be permanently erased and regenerated from scratch."
        confirmLabel="Reset World"
        destructive
        confirmationValue={world.name}
        onConfirm={handleReset}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${world.name}?`}
        description="This permanently deletes the world and all of its data. This cannot be undone."
        confirmLabel="Delete World"
        destructive
        confirmationValue={world.name}
        onConfirm={handleDelete}
      />
    </Card>
  );
}
