"use client";

import Link from "next/link";
import type { McNetwork } from "@/types";
import { useServerStore } from "@/stores/use-server-store";
import { ServerStatusBadge } from "@/components/shared/server-status-badge";
import { SoftwareIcon } from "@/components/shared/software-icon";
import { ServerBlockIcon } from "@/components/shared/server-block-icon";
import { Globe, Router } from "@/lib/icons";

export function NetworkDiagram({ network }: { network: McNetwork }) {
  const servers = useServerStore((s) => s.servers);
  const proxy = servers.find((s) => s.id === network.proxyServerId);
  const connected = servers.filter((s) => network.connectedServerIds.includes(s.id));

  return (
    <div className="flex flex-col items-center py-6">
      <div className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-surface px-5 py-3">
        <Globe className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Internet</span>
      </div>

      <div className="h-8 w-px bg-border" />

      {proxy && (
        <Link
          href={`/servers/${proxy.id}`}
          className="flex min-w-56 flex-col items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-6 py-4 transition-colors hover:bg-primary/10"
        >
          <div className="flex items-center gap-2">
            <Router className="size-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{proxy.name}</span>
          </div>
          <ServerStatusBadge status={proxy.status} />
          <span className="font-mono text-xs text-muted-foreground">
            {proxy.address.domain ?? `${proxy.address.host}:${proxy.address.port}`}
          </span>
          <span className="text-xs text-muted-foreground">{proxy.players.online} players online</span>
        </Link>
      )}

      <div className="h-8 w-px bg-border" />
      <div
        className="h-px bg-border"
        style={{ width: `${Math.max(connected.length * 180 - 32, 32)}px`, maxWidth: "100%" }}
      />

      <div className="mt-0 grid grid-cols-2 gap-x-6 gap-y-8 pt-0 sm:flex sm:flex-wrap sm:justify-center">
        {connected.map((server) => (
          <div key={server.id} className="flex flex-col items-center">
            <div className="h-6 w-px bg-border" />
            <Link
              href={`/servers/${server.id}`}
              className="flex w-40 flex-col items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:bg-hover"
            >
              <ServerBlockIcon serverId={server.id} icon={server.icon} size="sm" />
              <span className="text-sm font-medium text-foreground">{server.name}</span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <SoftwareIcon software={server.software} className="size-3 text-[6px]" />
                {server.players.online}/{server.players.max}
              </span>
              <ServerStatusBadge status={server.status} size="sm" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
