import type { FastifyInstance } from "fastify";
import { ApiError, ErrorCode, ulid } from "@mccore/contracts";
import { assertServerAccessible, requireServer } from "../servers/service.js";
import { toWorldDto } from "./service.js";
import { recordAudit } from "../audit/service.js";

/**
 * §37 scope note: world size/seed introspection and true "duplicate"
 * (copy-in-place) require either agent-side level.dat parsing or a
 * `file.copy` agent command that doesn't exist yet — both are real,
 * scoped-out gaps (documented in the final status report), not faked here.
 * What *is* real: listing known worlds, and reset/delete, which are
 * implemented as an agent file-delete of the world directory — Minecraft
 * regenerates a fresh world with the same seed/settings on next start for
 * "reset", or the server simply loses that world for "delete".
 */
export default async function worldsRoutes(app: FastifyInstance) {
  app.get("/api/v1/servers/:id/worlds", { preHandler: app.requirePermission("worlds.view") }, async (request) => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);
    const worlds = await app.prisma.world.findMany({ where: { serverId: id } });
    return { worlds: worlds.map(toWorldDto) };
  });

  app.post("/api/v1/servers/:id/worlds/:worldId/reset", { preHandler: app.requirePermission("worlds.manage") }, async (request) => {
    const { id, worldId } = request.params as { id: string; worldId: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app.prisma, id);
    if (server.status !== "OFFLINE") throw new ApiError(ErrorCode.CONFLICT, "Stop the server before resetting a world.");
    const world = await app.prisma.world.findFirst({ where: { id: worldId, serverId: id } });
    if (!world) throw new ApiError(ErrorCode.NOT_FOUND, "World not found.");
    if (!app.agentHub.isConnected(server.nodeId)) throw new ApiError(ErrorCode.NODE_OFFLINE, "Node is not connected.");

    const ack = await app.agentHub.sendCommand(server.nodeId, {
      commandId: ulid(),
      type: "file.delete",
      issuedAt: new Date().toISOString(),
      payload: { serverId: id, path: world.directoryName },
    });
    if (!ack.ok) throw new ApiError(ErrorCode.INTERNAL_ERROR, ack.errorMessage ?? "Failed to reset world.");

    await app.prisma.world.update({ where: { id: worldId }, data: { sizeMb: 0, lastBackupAt: null } });
    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "world.reset",
      description: `${request.user!.name} reset world "${world.name}" on "${server.name}". It will regenerate on next start.`,
      targetType: "world",
      targetLabel: world.name,
      serverId: id,
      severity: "WARNING",
      ipAddress: request.ip,
    });
    return { ok: true };
  });

  app.delete("/api/v1/servers/:id/worlds/:worldId", { preHandler: app.requirePermission("worlds.manage") }, async (request) => {
    const { id, worldId } = request.params as { id: string; worldId: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app.prisma, id);
    if (server.status !== "OFFLINE") throw new ApiError(ErrorCode.CONFLICT, "Stop the server before deleting a world.");
    const world = await app.prisma.world.findFirst({ where: { id: worldId, serverId: id } });
    if (!world) throw new ApiError(ErrorCode.NOT_FOUND, "World not found.");
    if (!app.agentHub.isConnected(server.nodeId)) throw new ApiError(ErrorCode.NODE_OFFLINE, "Node is not connected.");

    const ack = await app.agentHub.sendCommand(server.nodeId, {
      commandId: ulid(),
      type: "file.delete",
      issuedAt: new Date().toISOString(),
      payload: { serverId: id, path: world.directoryName },
    });
    if (!ack.ok) throw new ApiError(ErrorCode.INTERNAL_ERROR, ack.errorMessage ?? "Failed to delete world.");

    await app.prisma.world.delete({ where: { id: worldId } });
    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "world.deleted",
      description: `${request.user!.name} deleted world "${world.name}" from "${server.name}".`,
      targetType: "world",
      targetLabel: world.name,
      serverId: id,
      severity: "WARNING",
      ipAddress: request.ip,
    });
    return { ok: true };
  });
}
