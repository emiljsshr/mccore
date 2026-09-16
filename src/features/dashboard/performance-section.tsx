"use client";

import { useEffect, useState } from "react";
import type { MetricPoint, MetricRange } from "@/types";
import { getMetrics } from "@/services";
import { Skeleton } from "@/components/ui/skeleton";
import { useServerStore } from "@/stores/use-server-store";
import { cn } from "@/lib/utils";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

const RANGES: MetricRange[] = ["1h", "6h", "24h", "7d"];

function MiniMetricChart({
  data,
  dataKey,
  color,
  label,
  value,
}: {
  data: MetricPoint[];
  dataKey: keyof MetricPoint;
  color: string;
  label: string;
  value: string;
}) {
  const gradientId = `dash-gradient-${String(dataKey)}`;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-lg font-bold tabular-nums text-foreground">{value}</p>
      </div>
      <div className="h-14">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function DashboardPerformanceSection() {
  const servers = useServerStore((s) => s.servers);
  const [range, setRange] = useState<MetricRange>("24h");
  const [data, setData] = useState<MetricPoint[] | null>(null);

  const totalPlayers = servers.reduce((sum, s) => sum + s.players.online, 0);
  const maxPlayers = servers.reduce((sum, s) => sum + s.players.max, 0);
  const avgCpu = servers.length
    ? Math.round(servers.reduce((sum, s) => sum + s.resources.cpuPercent, 0) / servers.length)
    : 0;
  const memPercent = servers.length
    ? Math.round(
        (servers.reduce((sum, s) => sum + s.resources.memoryUsedMb, 0) /
          servers.reduce((sum, s) => sum + s.resources.memoryMaxMb, 0)) *
          100,
      )
    : 0;

  useEffect(() => {
    let active = true;
    getMetrics("fleet", range, totalPlayers, maxPlayers).then((points) => {
      if (active) setData(points);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">System Performance</h2>
        <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "rounded-sm px-2 py-1 text-xs font-medium text-muted-foreground transition-colors",
                r === range && "bg-foreground text-background",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <div className="space-y-4">
          <MiniMetricChart data={data} dataKey="cpu" color="var(--chart-1)" label="CPU Usage" value={`${avgCpu}%`} />
          <MiniMetricChart
            data={data}
            dataKey="memory"
            color="var(--chart-2)"
            label="Memory Usage"
            value={`${memPercent}%`}
          />
          <MiniMetricChart
            data={data}
            dataKey="players"
            color="var(--chart-1)"
            label="Online Players"
            value={String(totalPlayers)}
          />
        </div>
      )}
    </div>
  );
}
