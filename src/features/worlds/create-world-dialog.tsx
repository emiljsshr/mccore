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
import { createWorld } from "@/services";
import type { World } from "@/types";
import type { Difficulty, GameMode } from "@/types";

interface CreateWorldDialogProps {
  serverId: string;
  onCreated: (world: World) => void;
}

export function CreateWorldDialog({ serverId, onCreated }: CreateWorldDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [seed, setSeed] = useState("");
  const [environment, setEnvironment] = useState<World["environment"]>("overworld");
  const [generator, setGenerator] = useState<World["generator"]>("default");
  const [gameMode, setGameMode] = useState<GameMode>("survival");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [structures, setStructures] = useState(true);
  const [hardcore, setHardcore] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Give the world a name first.");
      return;
    }
    setPending(true);
    try {
      const world = await createWorld({
        serverId,
        name: name.trim(),
        seed,
        environment,
        generator,
        gameMode,
        difficulty,
        structures,
        hardcore,
      });
      onCreated(world);
      toast.success(`${world.name} created`);
      setOpen(false);
      setName("");
      setSeed("");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Create World
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create World</DialogTitle>
          <DialogDescription>Generate a new world for this server.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="world-name">Name</Label>
            <Input id="world-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="my_world" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="world-seed">Seed (optional)</Label>
            <Input id="world-seed" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Random" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Environment</Label>
              <Select value={environment} onValueChange={(v) => setEnvironment(v as World["environment"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overworld">Overworld</SelectItem>
                  <SelectItem value="nether">Nether</SelectItem>
                  <SelectItem value="the_end">The End</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Generator</Label>
              <Select value={generator} onValueChange={(v) => setGenerator(v as World["generator"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="flat">Superflat</SelectItem>
                  <SelectItem value="large_biomes">Large Biomes</SelectItem>
                  <SelectItem value="amplified">Amplified</SelectItem>
                  <SelectItem value="single_biome">Single Biome</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Game Mode</Label>
              <Select value={gameMode} onValueChange={(v) => setGameMode(v as GameMode)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="survival">Survival</SelectItem>
                  <SelectItem value="creative">Creative</SelectItem>
                  <SelectItem value="adventure">Adventure</SelectItem>
                  <SelectItem value="spectator">Spectator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="peaceful">Peaceful</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label htmlFor="structures" className="font-normal">
              Generate structures
            </Label>
            <Switch id="structures" checked={structures} onCheckedChange={setStructures} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label htmlFor="hardcore" className="font-normal">
              Hardcore mode
            </Label>
            <Switch id="hardcore" checked={hardcore} onCheckedChange={setHardcore} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Create World
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
