"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus } from "@/lib/icons";
import { createBackup, type CreateBackupInput } from "@/services";
import type { Backup } from "@/types";

interface CreateBackupDialogProps {
  serverId: string;
  onCreated?: (backup: Backup) => void;
}

export function CreateBackupDialog({ serverId, onCreated }: CreateBackupDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("Manual Backup");
  const [includeWorlds, setIncludeWorlds] = useState(true);
  const [includePlugins, setIncludePlugins] = useState(true);
  const [includeConfig, setIncludeConfig] = useState(true);
  const [compression, setCompression] = useState<CreateBackupInput["compression"]>("fast");

  async function handleCreate() {
    setPending(true);
    try {
      const backup = await createBackup({
        serverId,
        name: name.trim() || "Manual Backup",
        includeWorlds,
        includePlugins,
        includeConfig,
        compression,
      });
      onCreated?.(backup);
      toast.success("Backup started");
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Create Backup
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Backup</DialogTitle>
          <DialogDescription>Snapshot this server&apos;s data for safekeeping.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="backup-name">Name</Label>
            <Input id="backup-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label htmlFor="include-worlds" className="font-normal">
                Include Worlds
              </Label>
              <Switch id="include-worlds" checked={includeWorlds} onCheckedChange={setIncludeWorlds} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label htmlFor="include-plugins" className="font-normal">
                Include Plugins
              </Label>
              <Switch id="include-plugins" checked={includePlugins} onCheckedChange={setIncludePlugins} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label htmlFor="include-config" className="font-normal">
                Include Config
              </Label>
              <Switch id="include-config" checked={includeConfig} onCheckedChange={setIncludeConfig} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Compression</Label>
            <Select value={compression} onValueChange={(v) => setCompression(v as CreateBackupInput["compression"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="fast">Fast</SelectItem>
                <SelectItem value="best">Best</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Create Backup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
