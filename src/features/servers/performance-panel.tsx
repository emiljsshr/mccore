"use client";

import { useEffect, useState } from "react";
import type { MetricPoint, MetricRange } from "@/types";
import { getMetrics } from "@/services";
import { MetricChart } from "@/components/shared/metric-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PerformancePanelProps {
  serverId: string;
  basePlayers: number;
  maxPlayers: number;
}

const METRICS = [
  { key: "cpu", label: "CPU", color: "var(--chart-1)", unit: "%" },
  { key: "memory", label: "RAM", color: "var(--chart-2)", unit: "%" },
  { key: "tps", label: "TPS", color: "var(--chart-3)", unit: "" },
  { key: "mspt", label: "MSPT", color: "var(--chart-4)", unit: "ms" },
  { key: "players", label: "Players", color: "var(--chart-5)", unit: "" },
] as const;

export function ServerPerformancePanel({ serverId, basePlayers, maxPlayers }: PerformancePanelProps) {
  const [range, setRange] = useState<MetricRange>("1h");
  const [metric, setMetric] = useState<(typeof METRICS)[number]["key"]>("cpu");
  const [data, setData] = useState<MetricPoint[] | null>(null);

  useEffect(() => {
    let active = true;
    getMetrics(serverId, range, basePlayers, maxPlayers).then((points) => {
      if (active) setData(points);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, range]);

  const active = METRICS.find((m) => m.key === metric)!;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-sm font-medium">Performance</CardTitle>
        <Tabs value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
          <TabsList>
            {METRICS.map((m) => (
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
            ranges={["15m", "1h", "6h", "24h", "7d"]}
          />
        )}
      </CardContent>
    </Card>
  );
}
