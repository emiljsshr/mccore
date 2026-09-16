"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useServer } from "@/hooks/use-server";
import { ServerOverviewMetrics } from "@/features/servers/overview-metrics";
import { ServerPerformancePanel } from "@/features/servers/performance-panel";
import { ServerInfoPanel } from "@/features/servers/server-info-panel";

export default function ServerOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const server = useServer(id);

  if (!server) notFound();

  return (
    <div className="space-y-6">
      <ServerOverviewMetrics server={server} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ServerPerformancePanel
            serverId={server.id}
            basePlayers={server.players.online}
            maxPlayers={server.players.max}
          />
        </div>
        <ServerInfoPanel server={server} />
      </div>
    </div>
  );
}
