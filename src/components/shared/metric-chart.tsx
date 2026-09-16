"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricPoint, MetricRange } from "@/types";
import { METRIC_RANGE_LABEL } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface MetricChartProps {
  data: MetricPoint[];
  dataKey: keyof MetricPoint;
  color: string;
  unit?: string;
  range: MetricRange;
  onRangeChange?: (range: MetricRange) => void;
  ranges?: MetricRange[];
  height?: number;
  formatValue?: (value: number) => string;
}

function formatTick(iso: string) {
  const date = new Date(iso);
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function MetricChart({
  data,
  dataKey,
  color,
  unit = "",
  range,
  onRangeChange,
  ranges = ["15m", "1h", "6h", "24h", "7d"],
  height = 220,
  formatValue,
}: MetricChartProps) {
  const gradientId = `gradient-${String(dataKey)}`;

  return (
    <div className="space-y-3">
      {onRangeChange && (
        <div className="flex justify-end">
          <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
            {ranges.map((r) => (
              <Button
                key={r}
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onRangeChange(r)}
                className={cn(
                  "h-6 rounded-sm px-2 text-xs font-medium text-muted-foreground",
                  r === range && "bg-background text-foreground shadow-sm",
                )}
              >
                {METRIC_RANGE_LABEL[r]}
              </Button>
            ))}
          </div>
        </div>
      )}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTick}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "var(--popover-foreground)",
              }}
              labelFormatter={(value) => formatTick(String(value))}
              formatter={(value) => [
                formatValue ? formatValue(Number(value)) : `${value}${unit}`,
                undefined,
              ]}
            />
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
