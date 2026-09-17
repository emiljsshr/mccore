import type { Server } from "@/types";
import { formatMemory, formatUptime, formatDiskSize, formatPercent } from "@/lib/format";
import { Activity, Cpu, Gauge, HardDrive, MemoryStick, Timer, Users, Zap } from "@/lib/icons";
import type { LucideIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "critical";
}

const TONE_ICON_CLASSES: Record<NonNullable<StatTileProps["tone"]>, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-status-online-muted text-status-online",
  warning: "bg-status-warning-muted text-status-warning",
  critical: "bg-status-critical-muted text-status-critical",
};

function StatTile({ icon: Icon, label, value, tone = "default" }: StatTileProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", TONE_ICON_CLASSES[tone])}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-bold tabular-nums leading-tight text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function ServerOverviewMetrics({ server }: { server: Server }) {
  const isOnline = server.status === "online";
  const diskUsedGb = server.resources.diskUsedMb / 1024;
  const diskMaxGb = server.resources.diskMaxMb / 1024;

  const tpsTone = server.performance.tps >= 19 ? "success" : server.performance.tps >= 15 ? "warning" : "critical";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile icon={Users} label="Players" value={`${server.players.online} / ${server.players.max}`} />
      <StatTile
        icon={Gauge}
        label="TPS"
        value={isOnline ? server.performance.tps.toFixed(2) : "—"}
        tone={isOnline ? tpsTone : "default"}
      />
      <StatTile icon={Timer} label="MSPT" value={isOnline ? `${server.performance.mspt.toFixed(1)} ms` : "—"} />
      <StatTile icon={Cpu} label="CPU" value={isOnline ? formatPercent(server.resources.cpuPercent) : "—"} />
      <StatTile
        icon={MemoryStick}
        label="Memory"
        value={formatMemory(server.resources.memoryUsedMb, server.resources.memoryMaxMb)}
      />
      <StatTile icon={HardDrive} label="Disk" value={formatDiskSize(diskUsedGb, diskMaxGb)} />
      <StatTile icon={Activity} label="Uptime" value={formatUptime(server.uptimeSeconds)} />
      <StatTile
        icon={Zap}
        label="Status"
        value={isOnline ? "Healthy" : "—"}
        tone={isOnline ? "success" : "default"}
      />
    </div>
  );
}
