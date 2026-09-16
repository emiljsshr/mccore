import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { ApiError, ErrorCode, ulid } from "@mccore/contracts";
import { toNetworkDto, listNetworksWithConnections, getConnectedServerIds } from "./service.js";
import { recordAudit } from "../audit/service.js";

const CreateNetworkSchema = z.object({
  name: z.string().trim().min(1).max(96),
  description: z.string().trim().max(280).optional(),
  proxyServerId: z.string(),
});

const UpdateNetworkSchema = z.object({
  name: z.string().trim().min(1).max(96).optional(),
  description: z.string().trim().max(280).optional(),
  connectedServerIds: z.array(z.string()).optional(),
});

/** Same 3-line per-server access check as `modules/servers/routes.ts`
 * (`assertServerAccessible`) — duplicated locally since that module isn't
 * shared and shouldn't be touched by this task. */
function assertServerAccessible(request: FastifyRequest, serverId: string) {
  const ctx = request.user!;
  if (ctx.isSuperAdmin || ctx.serverIds === null || ctx.serverIds.includes(serverId)) return;
  throw new ApiError(ErrorCode.FORBIDDEN, "No access to this server.");
}

export default async function networksRoutes(app: FastifyInstance) {
  app.get("/api/v1/networks", { preHandler: app.requirePermission("server.view") }, async request => {
    const scope = request.user!.serverIds;
    const networks = await listNetworksWithConnections(app.prisma);
    return { networks: scope === null ? networks : networks.filter(n => scope.includes(n.proxyServerId)).map(n => ({ ...n, connectedServerIds: n.connectedServerIds.filter(id => scope.includes(id)) })) };
  });

  app.post("/api/v1/networks", { preHandler: app.requirePermission("server.create") }, async (request) => {
    const input = CreateNetworkSchema.parse(request.body);
    assertServerAccessible(request, input.proxyServerId);

    const proxyServer = await app.prisma.minecraftServer.findFirst({
      where: { id: input.proxyServerId, deletedAt: null },
    });
    if (!proxyServer) throw new ApiError(ErrorCode.SERVER_NOT_FOUND, "Proxy server not found.");

    const created = await app.prisma.network
      .create({
        data: {
          id: ulid(),
          name: input.name,
          description: input.description,
          proxyServerId: input.proxyServerId,
        },
      })
      .catch((err: { code?: string }) => {
        if (err?.code === "P2002") {
          throw new ApiError(ErrorCode.CONFLICT, "This server is already the proxy for another network.");
        }
        throw err;
      });

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "network.created",
      description: `${request.user!.name} created network "${created.name}".`,
      targetLabel: created.name,
      resourceId: created.id,
      severity: "SUCCESS",
      ipAddress: request.ip,
    });

    return { network: toNetworkDto(created, []) };
  });

  app.patch("/api/v1/networks/:id", { preHandler: app.requirePermission("server.create") }, async (request) => {
    const { id } = request.params as { id: string };
    const input = UpdateNetworkSchema.parse(request.body);

    const network = await app.prisma.network.findUnique({ where: { id } });
    if (!network) throw new ApiError(ErrorCode.NOT_FOUND, "Network not found.");

    const connectedServerIds = input.connectedServerIds !== undefined ? Array.from(new Set(input.connectedServerIds)) : undefined;

    if (connectedServerIds !== undefined) {
      if (connectedServerIds.includes(network.proxyServerId)) {
        throw new ApiError(ErrorCode.VALIDATION_ERROR, "The proxy server cannot also be a connected backend.");
      }
      if (connectedServerIds.length > 0) {
        const count = await app.prisma.minecraftServer.count({
          where: { id: { in: connectedServerIds }, deletedAt: null },
        });
        if (count !== connectedServerIds.length) {
          throw new ApiError(ErrorCode.VALIDATION_ERROR, "One or more connected server ids do not exist.");
        }
      }
    }

    if (input.name !== undefined || input.description !== undefined) {
      await app.prisma.network.update({
        where: { id },
        data: { name: input.name, description: input.description },
      });
    }

    if (connectedServerIds !== undefined) {
      const keep = connectedServerIds;
      await app.prisma.minecraftServer.updateMany({
        where: { networkId: id, id: { notIn: keep.length > 0 ? keep : ["__none__"] } },
        data: { networkId: null },
      });
      if (keep.length > 0) {
        await app.prisma.minecraftServer.updateMany({
          where: { id: { in: keep } },
          data: { networkId: id },
        });
      }
    }

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "network.updated",
      description: `${request.user!.name} updated network "${network.name}".`,
      targetLabel: network.name,
      resourceId: network.id,
      severity: "INFO",
      ipAddress: request.ip,
    });

    const updated = await app.prisma.network.findUniqueOrThrow({ where: { id } });
    const finalConnectedServerIds = await getConnectedServerIds(app.prisma, id);
    return { network: toNetworkDto(updated, finalConnectedServerIds) };
  });

  app.delete("/api/v1/networks/:id", { preHandler: app.requirePermission("server.delete") }, async (request) => {
    const { id } = request.params as { id: string };
    const network = await app.prisma.network.findUnique({ where: { id } });
    if (!network) throw new ApiError(ErrorCode.NOT_FOUND, "Network not found.");

    // Clear `networkId` on connected backends first so they're never left
    // pointing at a deleted network.
    await app.prisma.minecraftServer.updateMany({ where: { networkId: id }, data: { networkId: null } });
    await app.prisma.network.delete({ where: { id } });

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "network.deleted",
      description: `${request.user!.name} deleted network "${network.name}".`,
      targetLabel: network.name,
      resourceId: id,
      severity: "WARNING",
      ipAddress: request.ip,
    });

    return { ok: true };
  });
}
