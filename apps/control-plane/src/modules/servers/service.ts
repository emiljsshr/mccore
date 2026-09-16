import type { FastifyRequest } from "fastify";
import type { MinecraftServer, PrismaClient } from "@mccore/database";
import { ApiError, ErrorCode } from "@mccore/contracts";
import type { ServerDto } from "@mccore/contracts";

export function assertServerAccessible(request: FastifyRequest, serverId: string) {
  const ctx = request.user!;
  if (ctx.isSuperAdmin || ctx.serverIds === null || ctx.serverIds.includes(serverId)) return;
  throw new ApiError(ErrorCode.FORBIDDEN, "No access to this server.");
}

export async function requireServer(prisma: PrismaClient, id: string): Promise<MinecraftServer> {
  const server = await prisma.minecraftServer.findFirst({ where: { id, deletedAt: null } });
  if (!server) throw new ApiError(ErrorCode.SERVER_NOT_FOUND, "Server not found.");
  return server;
}

export function toServerDto(server: MinecraftServer): ServerDto {
  const uptimeSeconds =
    server.status === "ONLINE" && server.lastStartedAt
      ? Math.max(0, Math.floor((Date.now() - server.lastStartedAt.getTime()) / 1000))
      : 0;

  return {
    id: server.id,
    name: server.name,
    description: server.description ?? undefined,
    icon: server.icon,
    status: server.status.toLowerCase() as ServerDto["status"],
    software: server.software.toLowerCase() as ServerDto["software"],
    minecraftVersion: server.minecraftVersion,
    build: server.build ?? undefined,
    javaVersion: server.javaVersion,
    nodeId: server.nodeId,
    networkId: server.networkId ?? undefined,
    address: { host: server.host, port: server.port },
    players: { online: server.onlinePlayers, max: server.maxPlayers },
    resources: {
      cpuPercent: server.cpuPercent,
      cpuLimitPercent: server.cpuLimitPercent,
      memoryUsedMb: server.memoryUsedMb,
      memoryMaxMb: server.memoryMaxMb,
      diskUsedMb: server.diskUsedMb,
      diskMaxMb: server.diskLimitMb,
    },
    performance: { tps: server.lastTps, mspt: server.lastMspt },
    uptimeSeconds,
    createdAt: server.createdAt.toISOString(),
    lastStartedAt: server.lastStartedAt?.toISOString(),
    world: server.world,
    difficulty: server.difficulty.toLowerCase() as ServerDto["difficulty"],
    gameMode: server.gameMode.toLowerCase() as ServerDto["gameMode"],
    onlineMode: server.onlineMode,
    whitelist: server.whitelist,
    pvp: server.pvp,
    commandBlocks: server.commandBlocks,
    tags: server.tags,
  };
}

/** §72: acquire the per-server operation lock atomically; returns false if
 * another operation already holds it (and it isn't stale). */
export async function tryAcquireServerLock(
  prisma: import("@mccore/database").PrismaClient,
  serverId: string,
  operationId: string,
  staleAfterMs = 5 * 60 * 1000
): Promise<boolean> {
  const staleCutoff = new Date(Date.now() - staleAfterMs);
  const result = await prisma.minecraftServer.updateMany({
    where: {
      id: serverId,
      OR: [{ lockedOperationId: null }, { lockedAt: { lt: staleCutoff } }],
    },
    data: { lockedOperationId: operationId, lockedAt: new Date() },
  });
  return result.count === 1;
}

export async function releaseServerLock(prisma: import("@mccore/database").PrismaClient, serverId: string) {
  await prisma.minecraftServer.updateMany({ where: { id: serverId }, data: { lockedOperationId: null, lockedAt: null } });
}
