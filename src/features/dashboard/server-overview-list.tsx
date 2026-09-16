"use client";

import Link from "next/link";
import { useServerStore } from "@/stores/use-server-store";
import { ServerStatusDot } from "@/components/shared/server-status-badge";
import { ServerBlockIcon } from "@/components/shared/server-block-icon";
import { ServerActions } from "@/components/shared/server-actions";
import { SERVER_SOFTWARE_LABEL, SERVER_STATUS_LABEL } from "@/types";
import { Users } from "@/lib/icons";
import { SERVER_STATUS_VISUALS } from "@/lib/status-config";
import { cn } from "@/lib/utils";

export function ServerOverviewList() {
  const allServers = useServerStore((s) => s.servers);
  const servers = allServers.slice(0, 5);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="pb-2 font-medium">Name</th>
            <th className="hidden pb-2 font-medium sm:table-cell">Software</th>
            <th className="pb-2 font-medium">Players</th>
            <th className="hidden pb-2 font-medium md:table-cell">TPS</th>
            <th className="pb-2 font-medium">Status</th>
            <th className="hidden pb-2 font-medium lg:table-cell">Node</th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {servers.map((server) => {
            const visual = SERVER_STATUS_VISUALS[server.status];
            return (
              <tr key={server.id} className="group">
                <td className="py-2.5 pr-3">
                  <Link href={`/servers/${server.id}`} className="flex items-center gap-2.5">
                    <ServerBlockIcon serverId={server.id} icon={server.icon} size="sm" />
                    <span className="font-medium text-foreground">{server.name}</span>
                  </Link>
                </td>
                <td className="hidden py-2.5 pr-3 text-muted-foreground sm:table-cell">
                  {SERVER_SOFTWARE_LABEL[server.software]} {server.minecraftVersion}
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-3.5 text-muted-foreground sm:hidden" />
                    {server.players.online}/{server.players.max}
                  </span>
                </td>
                <td className="hidden py-2.5 pr-3 tabular-nums font-medium md:table-cell">
                  {server.status === "online" ? (
                    <span className="text-status-online">{server.performance.tps.toFixed(2)}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-2.5 pr-3">
                  <span className={cn("inline-flex items-center gap-1.5 font-medium", visual.colorClass)}>
                    <ServerStatusDot status={server.status} />
                    {SERVER_STATUS_LABEL[server.status]}
                  </span>
                </td>
                <td className="hidden py-2.5 pr-3 text-muted-foreground lg:table-cell">{server.nodeId}</td>
                <td className="py-2.5 text-right opacity-0 transition-opacity group-hover:opacity-100">
                  <ServerActions server={server} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
