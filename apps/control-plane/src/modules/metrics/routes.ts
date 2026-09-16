import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { ApiError, ErrorCode, MetricRangeSchema } from "@mccore/contracts";
import type { MetricPointDto } from "@mccore/contracts";
import type { ServerMetric, NodeMetric } from "@mccore/database";

const MAX_POINTS = 500;

const RANGE_TO_MS: Record<string, number> = {
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

const MetricsQuerySchema = z.object({ range: MetricRangeSchema.default("1h") });

/**
 * Even-stride downsampling: takes ~`maxPoints` samples spread across the
 * whole array rather than truncating, so a chart over a long range still
 * shows the full span instead of just its earliest slice.
 */
function strideSample<T>(rows: T[], maxPoints = MAX_POINTS): T[] {
  if (rows.length <= maxPoints) return rows;
  const stride = rows.length / maxPoints;
  const sampled: T[] = [];
  for (let i = 0; i < maxPoints; i++) {
    sampled.push(rows[Math.floor(i * stride)]);
  }
  return sampled;
}

function toServerMetricPointDto(row: ServerMetric): MetricPointDto {
  return {
    timestamp: row.timestamp.toISOString(),
    cpu: row.cpuPercent,
    memory: row.memoryUsedMb,
    players: row.playersOnline,
    tps: row.tps,
    mspt: row.mspt,
  };
}

/** No shared `packages/contracts` DTO exists yet for node metric history —
 * this mirrors the raw `NodeMetric` fields, matching the per-node "current
 * snapshot" shape already exposed on `NodeDto`. */
export interface NodeMetricPointDto {
  timestamp: string;
  cpuUsagePercent: number;
  memoryUsedMb: number;
  diskUsedMb: number;
  loadAverage1m: number;
  networkInMbps: number;
  networkOutMbps: number;
}

function toNodeMetricPointDto(row: NodeMetric): NodeMetricPointDto {
  return {
    timestamp: row.timestamp.toISOString(),
    cpuUsagePercent: row.cpuUsagePercent,
    memoryUsedMb: row.memoryUsedMb,
    diskUsedMb: row.diskUsedMb,
    loadAverage1m: row.loadAverage1m,
    networkInMbps: row.networkInMbps,
    networkOutMbps: row.networkOutMbps,
  };
}

/** Same 3-line per-server access check as `modules/servers/routes.ts`
 * (`assertServerAccessible`) — duplicated locally rather than imported
 * since that module isn't shared and shouldn't be touched by this task. */
function assertServerAccessible(request: FastifyRequest, serverId: string) {
  const ctx = request.user!;
  if (ctx.isSuperAdmin || ctx.serverIds === null || ctx.serverIds.includes(serverId)) return;
  throw new ApiError(ErrorCode.FORBIDDEN, "No access to this server.");
}

export default async function metricsRoutes(app: FastifyInstance) {
  app.get("/api/v1/servers/:id/metrics", { preHandler: app.requirePermission("server.view") }, async (request) => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);

    const server = await app.prisma.minecraftServer.findFirst({ where: { id, deletedAt: null } });
    if (!server) throw new ApiError(ErrorCode.SERVER_NOT_FOUND, "Server not found.");

    const { range } = MetricsQuerySchema.parse(request.query);
    const since = new Date(Date.now() - RANGE_TO_MS[range]);

    const rows = await app.prisma.serverMetric.findMany({
      where: { serverId: id, timestamp: { gte: since } },
      orderBy: { timestamp: "asc" },
    });

    return { points: strideSample(rows).map(toServerMetricPointDto) };
  });

  app.get("/api/v1/nodes/:id/metrics", { preHandler: app.requirePermission("nodes.view") }, async (request) => {
    const { id } = request.params as { id: string };

    const node = await app.prisma.node.findUnique({ where: { id } });
    if (!node) throw new ApiError(ErrorCode.NODE_NOT_FOUND, "Node not found.");

    const { range } = MetricsQuerySchema.parse(request.query);
    const since = new Date(Date.now() - RANGE_TO_MS[range]);

    const rows = await app.prisma.nodeMetric.findMany({
      where: { nodeId: id, timestamp: { gte: since } },
      orderBy: { timestamp: "asc" },
    });

    return { points: strideSample(rows).map(toNodeMetricPointDto) };
  });
}
