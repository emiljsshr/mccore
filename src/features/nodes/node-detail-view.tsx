"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { McNode, MetricPoint, MetricRange } from "@/types";
import { NODE_STATUS_VISUALS } from "@/lib/status-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricChart } from "@/components/shared/metric-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { ServerStatusBadge } from "@/components/shared/server-status-badge";
import { ServerBlockIcon } from "@/components/shared/server-block-icon";
import { formatRelativeTime } from "@/lib/format";
import { useServerStore } from "@/stores/use-server-store";
import { getNodeMetrics } from "@/services/metric-service";
import { cn } from "@/lib/utils";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

const CHART_METRICS = [
  { key: "cpu", label: "CPU", color: "var(--chart-1)", unit: "%" },
  { key: "memory", label: "Memory", color: "var(--chart-2)", unit: "MB" },
  { key: "players", label: "Disk usage", color: "var(--chart-3)", unit: "MB" },
  { key: "tps", label: "Network", color: "var(--chart-4)", unit: "Mbps" },
] as const;

export function NodeDetailView({ node }: { node: McNode }) {
  const visual = NODE_STATUS_VISUALS[node.status];
  const StatusIcon = visual.icon;
  const allServers = useServerStore((s) => s.servers);
  const servers = useMemo(() => allServers.filter((srv) => srv.nodeId === node.id), [allServers, node.id]);

  const [range, setRange] = useState<MetricRange>("1h");
  const [metric, setMetric] = useState<(typeof CHART_METRICS)[number]["key"]>("cpu");
  const [data, setData] = useState<MetricPoint[] | null>(null);

  useEffect(() => {
    let active = true;
    getNodeMetrics(node.id, range).then((points) => {
      if (active) setData(points);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, range]);

  const active = CHART_METRICS.find((m) => m.key === metric)!;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{node.name}</h1>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                visual.bgClass,
                visual.colorClass,
              )}
            >
              <StatusIcon className="size-3" />
              {visual.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{node.location}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-sm font-medium">Resource Usage</CardTitle>
              <Tabs value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
                <TabsList>
                  {CHART_METRICS.map((m) => (
                    <TabsTrigger key={m.key} value={m.key}>
                      {m.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              {!data ? (
                <Skeleton className="h-[220px] w-full" />
              ) : (
                <MetricChart
                  data={data}
                  dataKey={active.key}
                  color={active.color}
                  unit={active.unit}
                  range={range}
                  onRangeChange={setRange}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Servers on this Node</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {servers.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No servers running on this node.</p>
              ) : (
                servers.map((server) => (
                  <Link
                    key={server.id}
                    href={`/servers/${server.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 hover:text-primary"
                  >
                    <div className="flex items-center gap-2.5">
                      <ServerBlockIcon serverId={server.id} icon={server.icon} size="sm" />
                      <span className="text-sm font-medium text-foreground">{server.name}</span>
                    </div>
                    <ServerStatusBadge status={server.status} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Node Information</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <InfoRow label="Hostname" value={node.name} />
            <InfoRow label="IP Address" value={node.ipAddress} />
            <InfoRow label="Operating System" value={node.os} />
            <InfoRow label="Kernel" value={node.kernel} />
            <InfoRow label="Architecture" value={node.arch} />
            <InfoRow label="CPU" value={`${node.cpu.model} (${node.cpu.cores} cores)`} />
            <InfoRow label="Memory" value={`${node.memory.totalGb} GB`} />
            <InfoRow label="Storage" value={`${node.disk.totalGb} GB`} />
            <InfoRow label="Java Versions" value={node.javaVersions.join(", ")} />
            <InfoRow label="Agent Version" value={node.agentVersion} />
            <InfoRow label="Last Heartbeat" value={formatRelativeTime(node.lastHeartbeat)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
