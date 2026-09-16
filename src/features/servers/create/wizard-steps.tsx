"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { WizardState } from "@/features/servers/create/wizard-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SoftwareIcon } from "@/components/shared/software-icon";
import { IconPicker } from "@/components/shared/icon-picker";
import { ServerBlockIcon } from "@/components/shared/server-block-icon";
import { cn } from "@/lib/utils";
import { SERVER_SOFTWARE_LABEL } from "@/types";
import type { MinecraftSoftware, Difficulty, GameMode } from "@/types";
import { SOFTWARE_DESCRIPTIONS } from "@/mocks/versions";
import { useDataStore } from "@/stores/use-data-store";
import { formatDiskSize } from "@/lib/format";

export interface StepProps {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
}

const SOFTWARE_LIST: MinecraftSoftware[] = ["paper", "purpur", "vanilla", "velocity"];

export function StepBasics({ state, update }: StepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="wizard-name">Server Name</Label>
        <Input
          id="wizard-name"
          value={state.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Survival"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wizard-description">Description</Label>
        <Textarea
          id="wizard-description"
          value={state.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="What is this server for?"
          rows={3}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Icon</Label>
        <IconPicker value={state.icon} onChange={(icon) => update({ icon })} previewSeed={state.name || "new-server"} />
      </div>
    </div>
  );
}

export function StepMinecraft({ state, update }: StepProps) {
  return (
    <div className="space-y-3">
      <Label>Server Software</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {SOFTWARE_LIST.map((software) => (
          <button
            key={software}
            type="button"
            onClick={() =>
              update({ software, minecraftVersion: "" })
            }
            className={cn(
              "flex items-start gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-hover",
              state.software === software && "border-primary bg-primary/5",
            )}
          >
            <SoftwareIcon software={software} className="mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">{SERVER_SOFTWARE_LABEL[software]}</p>
              <p className="text-xs text-muted-foreground">{SOFTWARE_DESCRIPTIONS[software]}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function StepVersion({ state, update }: StepProps) {
  const [catalog, setCatalog] = useState<{ key: string; versions: string[]; error?: string }>({ key: "", versions: [] });
  const key = state.nodeId + ":" + state.software;
  const versions = catalog.key === key ? catalog.versions : [];
  useEffect(() => {
    let active = true;
    api<{ versions: string[] }>("/server-software/versions?nodeId=" + encodeURIComponent(state.nodeId) + "&software=" + state.software)
      .then(({ versions }) => { if (active) setCatalog({ key, versions }); })
      .catch(e => { if (active) setCatalog({ key, versions: [], error: e.message }); });
    return () => { active = false; };
  }, [key, state.nodeId, state.software]);
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Minecraft Version</Label>
        {catalog.key === key && catalog.error && <p role="alert" className="text-sm text-destructive">{catalog.error}</p>}
        <Select disabled={!versions.length} value={versions.includes(state.minecraftVersion) ? state.minecraftVersion : ""} onValueChange={(v) => update({ minecraftVersion: v })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {versions.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        The latest available build for {SERVER_SOFTWARE_LABEL[state.software]} {state.minecraftVersion} will be
        installed automatically.
      </p>
    </div>
  );
}

export function StepResources({ state, update }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Memory (Minimum)</Label>
          <span className="text-sm font-medium tabular-nums text-foreground">{state.memoryMinGb} GB</span>
        </div>
        <Slider
          value={[state.memoryMinGb]}
          min={1}
          max={state.memoryMaxGb}
          step={1}
          onValueChange={([v]) => update({ memoryMinGb: v })}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Memory (Maximum)</Label>
          <span className="text-sm font-medium tabular-nums text-foreground">{state.memoryMaxGb} GB</span>
        </div>
        <Slider
          value={[state.memoryMaxGb]}
          min={state.memoryMinGb}
          max={32}
          step={1}
          onValueChange={([v]) => update({ memoryMaxGb: v })}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>CPU Limit</Label>
          <span className="text-sm font-medium tabular-nums text-foreground">{state.cpuLimitPercent}%</span>
        </div>
        <Slider
          value={[state.cpuLimitPercent]}
          min={50}
          max={800}
          step={50}
          onValueChange={([v]) => update({ cpuLimitPercent: v })}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Disk Limit</Label>
          <span className="text-sm font-medium tabular-nums text-foreground">
            {formatDiskSize(0, state.diskLimitGb)}
          </span>
        </div>
        <Slider
          value={[state.diskLimitGb]}
          min={5}
          max={200}
          step={5}
          onValueChange={([v]) => update({ diskLimitGb: v })}
        />
      </div>
    </div>
  );
}

export function StepNetwork({ state, update }: StepProps) {
  const mockNodes = useDataStore(s => s.nodes);
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Node</Label>
        <Select value={state.nodeId} onValueChange={(v) => update({ nodeId: v })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {mockNodes.map((node) => (
              <SelectItem key={node.id} value={node.id} disabled={node.status === "offline"}>
                {node.name} — {node.location}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>IP Address</Label>
        <Input value={mockNodes.find((n) => n.id === state.nodeId)?.ipAddress ?? ""} disabled />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wizard-port">Port</Label>
        <Input
          id="wizard-port"
          type="number"
          value={state.port}
          onChange={(e) => update({ port: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}

export function StepGameSettings({ state, update }: StepProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="wizard-max-players">Max Players</Label>
          <Input
            id="wizard-max-players"
            type="number"
            value={state.maxPlayers}
            onChange={(e) => update({ maxPlayers: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Game Mode</Label>
          <Select value={state.gameMode} onValueChange={(v) => update({ gameMode: v as GameMode })}>
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
        <div className="col-span-2 space-y-1.5">
          <Label>Difficulty</Label>
          <Select value={state.difficulty} onValueChange={(v) => update({ difficulty: v as Difficulty })}>
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
          { key: "onlineMode" as const, label: "Online Mode", description: "Verify players with Mojang authentication." },
          { key: "whitelist" as const, label: "Whitelist", description: "Only allow whitelisted players to join." },
          { key: "pvp" as const, label: "PvP", description: "Allow player versus player combat." },
          { key: "commandBlocks" as const, label: "Command Blocks", description: "Enable command block usage." },
        ].map((toggle) => (
          <div key={toggle.key} className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
            <div>
              <Label className="font-normal">{toggle.label}</Label>
              <p className="text-xs text-muted-foreground">{toggle.description}</p>
            </div>
            <Switch checked={state[toggle.key]} onCheckedChange={(checked) => update({ [toggle.key]: checked })} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StepReview({ state }: StepProps) {
  const mockNodes = useDataStore(s => s.nodes);
  const node = mockNodes.find((n) => n.id === state.nodeId);
  const rows: [string, string][] = [
    ["Name", state.name || "—"],
    ["Software", `${SERVER_SOFTWARE_LABEL[state.software]} ${state.minecraftVersion}`],
    ["Memory", `${state.memoryMinGb} – ${state.memoryMaxGb} GB`],
    ["CPU Limit", `${state.cpuLimitPercent}%`],
    ["Disk Limit", `${state.diskLimitGb} GB`],
    ["Node", node ? `${node.name} (${node.location})` : "—"],
    ["Port", String(state.port)],
    ...(state.software === "velocity"
      ? []
      : ([
          ["Max Players", String(state.maxPlayers)],
          ["Game Mode", state.gameMode],
          ["Difficulty", state.difficulty],
          ["Online Mode", state.onlineMode ? "Enabled" : "Disabled"],
          ["Whitelist", state.whitelist ? "Enabled" : "Disabled"],
          ["PvP", state.pvp ? "Enabled" : "Disabled"],
          ["Command Blocks", state.commandBlocks ? "Enabled" : "Disabled"],
        ] as [string, string][])),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
        <ServerBlockIcon serverId={state.name || "new-server"} icon={state.icon} size="md" />
        <div>
          <p className="font-medium text-foreground">{state.name || "Unnamed Server"}</p>
          {state.description && <p className="text-sm text-muted-foreground">{state.description}</p>}
        </div>
      </div>
      <div className="divide-y divide-border rounded-xl border border-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-4 py-2 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium capitalize text-foreground">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
