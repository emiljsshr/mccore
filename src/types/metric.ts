export interface MetricPoint {
  timestamp: string;
  cpu: number;
  memory: number;
  players: number;
  tps: number;
  mspt: number;
}

export type MetricRange = "15m" | "1h" | "6h" | "24h" | "7d";

export const METRIC_RANGE_LABEL: Record<MetricRange, string> = {
  "15m": "15m",
  "1h": "1h",
  "6h": "6h",
  "24h": "24h",
  "7d": "7d",
};
