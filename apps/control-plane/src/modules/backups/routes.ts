import type { FastifyInstance } from "fastify";
import { ApiError, ErrorCode, ulid, CreateBackupInputSchema } from "@mccore/contracts";
import { assertServerAccessible, requireServer, tryAcquireServerLock } from "../servers/service.js";
import { toBackupDto } from "./service.js";
import { createOperation, toOperationDto } from "../operations/service.js";
import { recordAudit } from "../audit/service.js";

export default async function backupsRoutes(app: FastifyInstance) {
  app.get("/api/v1/servers/:id/backups", { preHandler: app.requirePermission("backups.view") }, async (request) => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);
    const backups = await app.prisma.backup.findMany({ where: { serverId: id }, orderBy: { createdAt: "desc" } });
    return { backups: backups.map(toBackupDto) };
  });

  app.post("/api/v1/servers/:id/backups", { preHandler: app.requirePermission("backups.create") }, async (request) => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app.prisma, id);
    if (!app.agentHub.isConnected(server.nodeId)) throw new ApiError(ErrorCode.NODE_OFFLINE, "Node is not connected.");

    const input = CreateBackupInputSchema.parse(request.body);
    const backupId = ulid();
    const operation = await createOperation(app.prisma, { type: "BACKUP_CREATE", resourceId: backupId, createdByUserId: request.user!.id });

    const locked = await tryAcquireServerLock(app.prisma, server.id, operation.id);
    if (!locked) throw new ApiError(ErrorCode.SERVER_BUSY, "Another operation is already in progress for this server.");

    const backup = await app.prisma.backup.create({
      data: {
        id: backupId,
        serverId: server.id,
        name: input.name,
        type: "MANUAL",
        status: "IN_PROGRESS",
        storageProvider: "local",
        storagePath: `${server.id}/${backupId}.tar.zst`,
        includesWorlds: input.includesWorlds,
        includesPlugins: input.includesPlugins,
        includesConfig: input.includesConfig,
        compression: input.compression,
        createdByUserId: request.user!.id,
      },
    });

    try {
      await app.agentHub.sendCommand(server.nodeId, {
        commandId: ulid(),
        type: "backup.create",
        issuedAt: new Date().toISOString(),
        payload: {
          serverId: server.id,
          backupId,
          includesWorlds: input.includesWorlds,
          includesPlugins: input.includesPlugins,
          includesConfig: input.includesConfig,
          compression: input.compression,
        },
      });
    } catch (err) {
      await app.prisma.backup.update({ where: { id: backupId }, data: { status: "FAILED", errorMessage: (err as Error).message } });
      await app.prisma.minecraftServer.update({ where: { id: server.id }, data: { lockedOperationId: null, lockedAt: null } });
      throw new ApiError(ErrorCode.NODE_UNAVAILABLE, "Node did not accept the backup command.");
    }

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "backup.created",
      description: `${request.user!.name} started a backup ("${backup.name}") of "${server.name}".`,
      targetType: "backup",
      targetLabel: backup.name,
      serverId: server.id,
      resourceId: backup.id,
      severity: "INFO",
      ipAddress: request.ip,
    });

    return { backup: toBackupDto(backup), operation: toOperationDto(operation) };
  });

  app.post("/api/v1/servers/:id/backups/:backupId/restore", { preHandler: app.requirePermission("backups.restore") }, async (request) => {
    const { id, backupId } = request.params as { id: string; backupId: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app.prisma, id);
    const backup = await app.prisma.backup.findFirst({ where: { id: backupId, serverId: id } });
    if (!backup) throw new ApiError(ErrorCode.BACKUP_NOT_FOUND, "Backup not found.");
    if (backup.status !== "COMPLETED") throw new ApiError(ErrorCode.CONFLICT, "Only a completed backup can be restored.");
    if (!app.agentHub.isConnected(server.nodeId)) throw new ApiError(ErrorCode.NODE_OFFLINE, "Node is not connected.");

    const operation = await createOperation(app.prisma, { type: "BACKUP_RESTORE", resourceId: server.id, createdByUserId: request.user!.id });
    const locked = await tryAcquireServerLock(app.prisma, server.id, operation.id);
    if (!locked) throw new ApiError(ErrorCode.SERVER_BUSY, "Another operation is already in progress for this server (restart, backup, plugin update or world change).");

    try {
      const ack = await app.agentHub.sendCommand(server.nodeId, {
        commandId: ulid(),
        type: "backup.restore",
        issuedAt: new Date().toISOString(),
        payload: { serverId: server.id, backupId: backup.id, operationId: operation.id, expectedSha256: backup.checksumSha256 ?? undefined },
      });
      if (!ack.ok) throw new Error(ack.errorMessage ?? "Agent rejected the restore command.");
    } catch (err) {
      await app.prisma.minecraftServer.update({ where: { id: server.id }, data: { lockedOperationId: null, lockedAt: null } });
      throw new ApiError(ErrorCode.NODE_UNAVAILABLE, (err as Error).message);
    }

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "backup.restore",
      description: `${request.user!.name} restored "${server.name}" from backup "${backup.name}".`,
      targetType: "backup",
      targetLabel: backup.name,
      serverId: server.id,
      resourceId: backup.id,
      severity: "WARNING",
      ipAddress: request.ip,
    });

    return { operation: toOperationDto(operation) };
  });

  app.delete("/api/v1/servers/:id/backups/:backupId", { preHandler: app.requirePermission("backups.delete") }, async (request) => {
    const { id, backupId } = request.params as { id: string; backupId: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app.prisma, id);
    const backup = await app.prisma.backup.findFirst({ where: { id: backupId, serverId: id } });
    if (!backup) throw new ApiError(ErrorCode.BACKUP_NOT_FOUND, "Backup not found.");
    if (backup.status === "IN_PROGRESS") throw new ApiError(ErrorCode.BACKUP_IN_PROGRESS, "Cannot delete a backup while it is in progress.");

    if (app.agentHub.isConnected(server.nodeId)) {
      await app.agentHub
        .sendCommand(server.nodeId, {
          commandId: ulid(),
          type: "backup.delete",
          issuedAt: new Date().toISOString(),
          payload: { serverId: id, backupId },
        })
        .catch((err) => request.log.warn({ err, backupId }, "backup.delete command failed; removing DB record anyway"));
    }
    await app.prisma.backup.delete({ where: { id: backupId } });

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "backup.deleted",
      description: `${request.user!.name} deleted backup "${backup.name}".`,
      targetType: "backup",
      targetLabel: backup.name,
      serverId: id,
      severity: "WARNING",
      ipAddress: request.ip,
    });
    return { ok: true };
  });
}
