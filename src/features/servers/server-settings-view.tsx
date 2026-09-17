"use client";

import { api, mutation } from "@/lib/api";
import { getServer } from "@/services/server-service";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Server } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { IconPicker } from "@/components/shared/icon-picker";
import { MotdEditor } from "@/components/shared/motd-editor";
import { ServerIconUpload } from "@/components/shared/server-icon-upload";
import { deleteServer } from "@/services";
import { Loader2 } from "@/lib/icons";

export function ServerSettingsView({ server }: { server: Server }) {
  const router = useRouter();
  const [name, setName] = useState(server.name);
  const [icon, setIcon] = useState(server.icon);
  const [description, setDescription] = useState(server.description ?? "");
  const [motd, setMotd] = useState(server.motd ?? "");
  const [newServerIcon, setNewServerIcon] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(server.players.max);
  const [gameMode, setGameMode] = useState(server.gameMode);
  const [difficulty, setDifficulty] = useState(server.difficulty);
  const [onlineMode, setOnlineMode] = useState(server.onlineMode);
  const [whitelist, setWhitelist] = useState(server.whitelist);
  const [pvp, setPvp] = useState(server.pvp);
  const [commandBlocks, setCommandBlocks] = useState(server.commandBlocks);
  const [memoryMaxGb, setMemoryMaxGb] = useState(server.resources.memoryMaxMb / 1024);
  const [cpuLimit, setCpuLimit] = useState(server.resources.cpuLimitPercent);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await api(`/servers/${server.id}`, mutation("PATCH", {
        name, icon, description, maxPlayers, gameMode, difficulty, onlineMode, whitelist, pvp, commandBlocks, motd,
        memoryMaxMb: memoryMaxGb * 1024, cpuLimitPercent: cpuLimit,
        ...(newServerIcon ? { serverIconBase64: newServerIcon } : {}),
      }));
      await getServer(server.id); toast.success("Settings saved");
    } catch(e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }

  async function handleDelete() {
    await deleteServer(server.id);
    toast.success(`${server.name} deleted`);
    router.push("/servers");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="server-name">Server Name</Label>
            <Input id="server-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Dashboard Icon</Label>
            <IconPicker value={icon} onChange={setIcon} previewSeed={server.id} />
          </div>
          <div className="space-y-1.5">
            <Label>Minecraft Server Icon</Label>
            <ServerIconUpload value={newServerIcon} onChange={setNewServerIcon} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="server-description">Description</Label>
            <Textarea
              id="server-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <MotdEditor value={motd} onChange={setMotd} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Resources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="memory-max">Max Memory (GB)</Label>
              <Input
                id="memory-max"
                type="number"
                value={memoryMaxGb}
                onChange={(e) => setMemoryMaxGb(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cpu-limit">CPU Limit (%)</Label>
              <Input id="cpu-limit" type="number" value={cpuLimit} onChange={(e) => setCpuLimit(Number(e.target.value))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Game Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="max-players">Max Players</Label>
              <Input
                id="max-players"
                type="number"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Game Mode</Label>
              <Select value={gameMode} onValueChange={(v) => setGameMode(v as Server["gameMode"])}>
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
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Server["difficulty"])}>
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

          <div className="space-y-2">
            {[
              { label: "Online Mode", value: onlineMode, set: setOnlineMode },
              { label: "Whitelist", value: whitelist, set: setWhitelist },
              { label: "PvP", value: pvp, set: setPvp },
              { label: "Command Blocks", value: commandBlocks, set: setCommandBlocks },
            ].map((toggle) => (
              <div key={toggle.label} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <Label className="font-normal">{toggle.label}</Label>
                <Switch checked={toggle.value} onCheckedChange={toggle.set} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save Changes
        </Button>
      </div>

      <Card className="border-status-critical/30">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-status-critical">Danger Zone</CardTitle>
          <CardDescription>Irreversible and destructive actions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-md border border-status-critical/30 bg-status-critical-muted px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Delete this server</p>
              <p className="text-xs text-muted-foreground">
                Permanently delete this server, its worlds, plugins and configuration.
              </p>
            </div>
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              Delete Server
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${server.name}?`}
        description="This permanently deletes the server, its worlds, plugins and configuration. This action cannot be undone."
        confirmLabel="Delete Server"
        destructive
        confirmationValue={server.name}
        onConfirm={handleDelete}
      />
    </div>
  );
}
