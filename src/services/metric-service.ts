import type { MetricPoint, MetricRange } from "@/types";
import { api } from "@/lib/api";
export async function getMetrics(entityId: string, range: MetricRange, _basePlayers: number, _maxPlayers: number): Promise<MetricPoint[]> {
  return (await api<{ points: MetricPoint[] }>(`/servers/${entityId}/metrics?range=${range}`)).points;
}

export async function getNodeMetrics(id: string, range: MetricRange): Promise<MetricPoint[]> {
  const { points } = await api<{ points: { timestamp: string; cpuUsagePercent: number; memoryUsedMb: number; diskUsedMb: number; networkInMbps: number; networkOutMbps: number }[] }>(`/nodes/${id}/metrics?range=${range}`);
  return points.map(p => ({ timestamp: p.timestamp, cpu: p.cpuUsagePercent, memory: p.memoryUsedMb, players: p.diskUsedMb, tps: p.networkInMbps + p.networkOutMbps, mspt: 0 }));
}
