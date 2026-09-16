"use client";

import Link from "next/link";
import { ChevronRight, Server, Users, MemoryStick, HardDrive } from "@/lib/icons";
import type { LucideIcon } from "@/lib/icons";
import { useServerStore } from "@/stores/use-server-store";
import { useDataStore } from "@/stores/use-data-store";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  href: string;
  icon: LucideIcon;
  label: string;
  value: string;
  sublabel: string;
  tone?: "default" | "warning";
}

function KpiCard({ href, icon: Icon, label, value, sublabel, tone = "default" }: KpiCardProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-hover"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold tabular-nums leading-tight text-foreground">{value}</p>
        <p
          className={cn(
            "text-xs font-medium",
            tone === "warning" ? "text-status-warning" : "text-muted-foreground",
          )}
        >
          {sublabel}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function DashboardKpiRow() {
  const mockNodes = useDataStore(s => s.nodes);
  const servers = useServerStore((s) => s.servers);

  const onlineServers = servers.filter((s) => s.status === "online").length;
  const totalPlayers = servers
    .filter((s) => s.software !== "velocity")
    .reduce((sum, s) => sum + s.players.online, 0);
  const memoryUsedGb = servers.reduce((sum, s) => sum + s.resources.memoryUsedMb, 0) / 1024;
  const memoryMaxGb = servers.reduce((sum, s) => sum + s.resources.memoryMaxMb, 0) / 1024;
  const healthyNodes = mockNodes.filter((n) => n.status === "healthy").length;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        href="/servers"
        icon={Server}
        label="Servers"
        value={`${onlineServers} / ${servers.length}`}
        sublabel="Online"
      />
      <KpiCard
        href="/servers"
        icon={Users}
        label="Players"
        value={`${totalPlayers}`}
        sublabel="Online"
      />
      <KpiCard
        href="/settings"
        icon={MemoryStick}
        label="Memory"
        value={`${memoryUsedGb.toFixed(1)} / ${memoryMaxGb.toFixed(0)} GB`}
        sublabel="In use"
      />
      <KpiCard
        href="/nodes"
        icon={HardDrive}
        label="Nodes"
        value={`${healthyNodes} / ${mockNodes.length}`}
        sublabel="Healthy"
        tone={healthyNodes === mockNodes.length ? "default" : "warning"}
      />
    </div>
  );
}
