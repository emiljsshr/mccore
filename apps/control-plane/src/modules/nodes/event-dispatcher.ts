import { rememberConsole } from "../servers/console-history.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ulid } from "@mccore/contracts";
import type { AgentEventFrame } from "@mccore/contracts";
import { updateOperation } from "../operations/service.js";
import { releaseServerLock } from "../servers/service.js";

/**
 * Agent → Control Plane event payloads (§29). These are richer than the
 * browser-facing schemas in `@mccore/contracts` events.ts — e.g. they carry
 * `serverId`/`operationId` so the dispatcher knows what to update — and are
 * trimmed down before being relayed to `/ws/live` subscribers.
 */
const ServerStatusPayload = z.object({
  serverId: z.string(),
  status: z.enum(["installing", "offline", "starting", "online", "stopping", "restarting", "crashed", "error"]),
  message: z.string().optional(),
  pid: z.number().int().optional(),
});

const ServerConsolePayload = z.object({
  serverId: z.string(),
  lines: z.array(z.object({ id: z.string(), timestamp: z.string(), level: z.string(), message: z.string() })),
});

const ServerInstallProgressPayload = z.object({
  serverId: z.string(),
  operationId: z.string(),
  stage: z.enum(["PREPARING", "DOWNLOADING", "VERIFYING", "CONFIGURING", "READY", "STARTING", "ONLINE", "FAILED"]),
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
});

const ServerMetricsPayload = z.object({
  serverId: z.string(),
  cpuPercent: z.number(),
  memoryUsedMb: z.number(),
  playersOnline: z.number().int(),
  tps: z.number(),
  mspt: z.number(),
});

const PlayerEventPayload = z.object({ serverId: z.string(), uuid: z.string(), username: z.string() });

const BackupProgressPayload = z.object({
  serverId: z.string(),
  backupId: z.string(),
  stage: z.enum(["PREPARING", "SAVING", "COMPRESSING", "HASHING", "COMPLETED", "FAILED"]),
  progress: z.number().min(0).max(100),
  sizeMb: z.number().optional(),
  checksumSha256: z.string().optional(),
  errorMessage: z.string().optional(),
});

const PluginInstallProgressPayload = z.object({
  serverId: z.string(),
  operationId: z.string(),
  fileName: z.string().optional(),
  stage: z.enum(["RESOLVING", "DOWNLOADING", "VERIFYING", "INSTALLING", "COMPLETED", "FAILED"]),
  progress: z.number().min(0).max(100),
  fileSizeMb: z.number().optional(),
  checksumSha256: z.string().optional(),
  errorMessage: z.string().optional(),
});

/** §39: restore is its own multi-stage flow (stop → verify → restore to
 * temp → atomic swap → optionally restart), distinct from backup.progress
 * (which covers *creating* a backup). Shares the server operation lock
 * acquired by modules/backups/routes.ts — released here on any terminal
 * stage since the agent, not the Control Plane, knows when the swap is
 * actually done. */
const RestoreProgressPayload = z.object({
  serverId: z.string(),
  backupId: z.string(),
  operationId: z.string(),
  stage: z.enum(["PREPARING", "STOPPING", "RESTORING", "VERIFYING", "STARTING", "COMPLETED", "FAILED"]),
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
});

export async function dispatchAgentEvent(app: FastifyInstance, frame: { kind: "event" } & AgentEventFrame) {
  try {
    switch (frame.type) {
      case "server.status":
        return await onServerStatus(app, ServerStatusPayload.parse(frame.payload));
      case "server.console":
        return onServerConsole(app, ServerConsolePayload.parse(frame.payload));
      case "server.install.progress":
        return await onInstallProgress(app, ServerInstallProgressPayload.parse(frame.payload));
      case "server.metrics":
        return await onServerMetrics(app, ServerMetricsPayload.parse(frame.payload));
      case "player.join":
        return await onPlayerJoin(app, PlayerEventPayload.parse(frame.payload));
      case "player.leave":
        return await onPlayerLeave(app, PlayerEventPayload.parse(frame.payload));
      case "backup.progress":
        return await onBackupProgress(app, BackupProgressPayload.parse(frame.payload));
      case "backup.restore.progress":
        return await onRestoreProgress(app, RestoreProgressPayload.parse(frame.payload));
      case "plugin.install.progress":
        return await onPluginInstallProgress(app, PluginInstallProgressPayload.parse(frame.payload));
      default:
        app.log.debug({ type: frame.type }, "unhandled agent event type");
    }
  } catch (err) {
    app.log.error({ err, type: frame.type, nodeId: frame.nodeId }, "failed to process agent event");
  }
}

async function onServerStatus(app: FastifyInstance, payload: z.infer<typeof ServerStatusPayload>) {
  const status = payload.status.toUpperCase() as
    | "INSTALLING" | "OFFLINE" | "STARTING" | "ONLINE" | "STOPPING" | "RESTARTING" | "CRASHED" | "ERROR";
  const data: Record<string, unknown> = { status };
  if (payload.pid !== undefined) data.currentPid = payload.pid;
  if (status === "ONLINE") data.lastStartedAt = new Date();
  if (status === "OFFLINE" || status === "CRASHED" || status === "ERROR") {
    data.currentPid = null;
    data.onlinePlayers = 0;
  }
  const server = await app.prisma.minecraftServer.findUnique({ where: { id: payload.serverId } });
  if (server?.lockedOperationId) {
    const operation = await app.prisma.operation.findUnique({ where: { id: server.lockedOperationId } });
    const terminal = operation && (["SERVER_START", "SERVER_RESTART"].includes(operation.type) ? ["ONLINE", "CRASHED", "ERROR"].includes(status) : ["SERVER_STOP", "SERVER_KILL"].includes(operation.type) && ["OFFLINE", "CRASHED", "ERROR"].includes(status));
    if (terminal && operation) {
      await updateOperation(app.prisma, operation.id, { status: status === "ERROR" || (status === "CRASHED" && operation.type !== "SERVER_KILL") ? "FAILED" : "SUCCEEDED", progress: 100, message: payload.message });
      data.lockedOperationId = null; data.lockedAt = null;
    }
  }

  await app.prisma.minecraftServer.update({ where: { id: payload.serverId }, data }).catch(() => undefined);
  app.liveHub.broadcast(`server:${payload.serverId}`, "server.status", payload.serverId, {
    status: payload.status,
    message: payload.message,
  });

  if (status === "CRASHED") {
    await app.prisma.notification.create({
      data: {
        id: ulid(),
        type: "CRITICAL",
        title: "Server crashed",
        message: `A server process exited unexpectedly.${payload.message ? ` ${payload.message}` : ""}`,
        serverId: payload.serverId,
      },
    });
  }
}

function onServerConsole(app: FastifyInstance, payload: z.infer<typeof ServerConsolePayload>) {
  rememberConsole(app, payload.serverId, payload.lines);
  app.liveHub.broadcast(`server:${payload.serverId}`, "server.console", payload.serverId, { lines: payload.lines });
}

async function onInstallProgress(app: FastifyInstance, payload: z.infer<typeof ServerInstallProgressPayload>) {
  const status = payload.stage === "FAILED" ? "FAILED" : ["ONLINE", "READY"].includes(payload.stage) ? "SUCCEEDED" : "RUNNING";
  await updateOperation(app.prisma, payload.operationId, { status, progress: payload.progress, message: payload.message }).catch(() => undefined);

  if (payload.stage === "FAILED") {
    await app.prisma.minecraftServer.update({ where: { id: payload.serverId }, data: { status: "ERROR", lockedOperationId: null, lockedAt: null } }).catch(() => undefined);
  } else if (payload.stage === "READY") {
    // Release the install lock unconditionally here: if autoStart then
    // starts the server right after, the agent's own "server.status:
    // starting" event (routed through onServerStatus, not this handler)
    // re-acquires nothing — the lock was only ever protecting the install
    // itself — so there's no race with a subsequent autostart.
    await app.prisma.minecraftServer.update({ where: { id: payload.serverId }, data: { status: "OFFLINE", lockedOperationId: null, lockedAt: null } }).catch(() => undefined);
  }

  app.liveHub.broadcast(`server:${payload.serverId}`, "server.install.progress", payload.serverId, {
    operationId: payload.operationId,
    stage: payload.stage,
    progress: payload.progress,
    message: payload.message,
  });
  app.liveHub.broadcast(`server:${payload.serverId}`, "operation.updated", payload.operationId, {
    operationId: payload.operationId,
    status,
    progress: payload.progress,
    message: payload.message,
  });
}

async function onServerMetrics(app: FastifyInstance, payload: z.infer<typeof ServerMetricsPayload>) {
  await app.prisma.minecraftServer
    .update({
      where: { id: payload.serverId },
      data: {
        cpuPercent: payload.cpuPercent,
        memoryUsedMb: payload.memoryUsedMb,
        onlinePlayers: payload.playersOnline,
        lastTps: payload.tps,
        lastMspt: payload.mspt,
      },
    })
    .catch(() => undefined);

  await app.prisma.serverMetric.create({
    data: {
      id: ulid(),
      serverId: payload.serverId,
      cpuPercent: payload.cpuPercent,
      memoryUsedMb: payload.memoryUsedMb,
      playersOnline: payload.playersOnline,
      tps: payload.tps,
      mspt: payload.mspt,
    },
  });

  app.liveHub.broadcast(`server:${payload.serverId}`, "server.metrics", payload.serverId, {
    timestamp: new Date().toISOString(),
    cpu: payload.cpuPercent,
    memory: payload.memoryUsedMb,
    players: payload.playersOnline,
    tps: payload.tps,
    mspt: payload.mspt,
  });
}

async function onPlayerJoin(app: FastifyInstance, payload: z.infer<typeof PlayerEventPayload>) {
  const player = await app.prisma.player.upsert({
    where: { uuid: payload.uuid },
    update: { username: payload.username, lastSeenAt: new Date() },
    create: { id: ulid(), uuid: payload.uuid, username: payload.username, avatarSeed: payload.uuid },
  });
  await app.prisma.playerSession.create({
    data: { id: ulid(), playerId: player.id, serverId: payload.serverId },
  });
  await app.prisma.minecraftServer.update({ where: { id: payload.serverId }, data: { onlinePlayers: { increment: 1 } } }).catch(() => undefined);
  app.liveHub.broadcast(`server:${payload.serverId}`, "player.join", payload.serverId, { uuid: payload.uuid, username: payload.username });
}

async function onPlayerLeave(app: FastifyInstance, payload: z.infer<typeof PlayerEventPayload>) {
  const player = await app.prisma.player.findUnique({ where: { uuid: payload.uuid } });
  if (player) {
    const session = await app.prisma.playerSession.findFirst({
      where: { playerId: player.id, serverId: payload.serverId, leftAt: null },
      orderBy: { joinedAt: "desc" },
    });
    if (session) {
      const durationSeconds = Math.max(0, Math.round((Date.now() - session.joinedAt.getTime()) / 1000));
      await app.prisma.playerSession.update({ where: { id: session.id }, data: { leftAt: new Date(), durationSeconds } });
      await app.prisma.player.update({
        where: { id: player.id },
        data: { lastSeenAt: new Date(), playtimeSeconds: { increment: durationSeconds } },
      });
    }
  }
  await app.prisma.minecraftServer
    .update({ where: { id: payload.serverId }, data: { onlinePlayers: { decrement: 1 } } })
    .catch(() => undefined);
  app.liveHub.broadcast(`server:${payload.serverId}`, "player.leave", payload.serverId, { uuid: payload.uuid, username: payload.username });
}

async function onBackupProgress(app: FastifyInstance, payload: z.infer<typeof BackupProgressPayload>) {
  await app.prisma.operation.updateMany({ where: { resourceId: payload.backupId, type: "BACKUP_CREATE", status: { in: ["PENDING", "RUNNING"] } }, data: { status: payload.stage === "COMPLETED" ? "SUCCEEDED" : payload.stage === "FAILED" ? "FAILED" : "RUNNING", progress: Math.round(payload.progress), message: payload.errorMessage, ...(["COMPLETED", "FAILED"].includes(payload.stage) ? { completedAt: new Date() } : {}) } });
  if (payload.stage === "COMPLETED") {
    await app.prisma.backup.update({
      where: { id: payload.backupId },
      data: { status: "COMPLETED", sizeMb: payload.sizeMb ?? 0, checksumSha256: payload.checksumSha256 },
    });
  } else if (payload.stage === "FAILED") {
    await app.prisma.backup.update({
      where: { id: payload.backupId },
      data: { status: "FAILED", errorMessage: payload.errorMessage ?? "Backup failed." },
    });
    await app.prisma.notification.create({
      data: { id: ulid(), type: "WARNING", title: "Backup failed", message: payload.errorMessage ?? "A scheduled backup failed.", serverId: payload.serverId },
    });
  }
  if (payload.stage === "COMPLETED" || payload.stage === "FAILED") {
    await releaseServerLock(app.prisma, payload.serverId).catch(() => undefined);
  }
  app.liveHub.broadcast(`server:${payload.serverId}`, "backup.progress", payload.backupId, {
    backupId: payload.backupId,
    stage: payload.stage,
    progress: payload.progress,
  });
}

async function onRestoreProgress(app: FastifyInstance, payload: z.infer<typeof RestoreProgressPayload>) {
  const status = payload.stage === "FAILED" ? "FAILED" : payload.stage === "COMPLETED" ? "SUCCEEDED" : "RUNNING";
  await updateOperation(app.prisma, payload.operationId, { status, progress: payload.progress, message: payload.message }).catch(() => undefined);
  if (payload.stage === "COMPLETED" || payload.stage === "FAILED") {
    await releaseServerLock(app.prisma, payload.serverId).catch(() => undefined);
    if (payload.stage === "FAILED") {
      await app.prisma.minecraftServer.update({ where: { id: payload.serverId }, data: { status: "ERROR" } }).catch(() => undefined);
    }
  }
  app.liveHub.broadcast(`server:${payload.serverId}`, "operation.updated", payload.operationId, {
    operationId: payload.operationId,
    status,
    progress: payload.progress,
    message: payload.message,
  });
}

async function onPluginInstallProgress(app: FastifyInstance, payload: z.infer<typeof PluginInstallProgressPayload>) {
  const status = payload.stage === "FAILED" ? "FAILED" : payload.stage === "COMPLETED" ? "SUCCEEDED" : "RUNNING";
  if (payload.stage === "COMPLETED" && payload.fileName) {
    // Publish completion only after the installed plugin is queryable.
    await upsertInstalledPluginFromOperation(app, payload);
  }
  await updateOperation(app.prisma, payload.operationId, { status, progress: payload.progress, errorCode: payload.stage === "FAILED" ? payload.errorMessage : undefined });
  if (payload.stage === "COMPLETED" || payload.stage === "FAILED") {
    await app.prisma.minecraftServer.updateMany({ where: { id: payload.serverId, lockedOperationId: payload.operationId }, data: { lockedOperationId: null, lockedAt: null } });
  }
  app.liveHub.broadcast(`server:${payload.serverId}`, "plugin.install.progress", payload.serverId, {
    operationId: payload.operationId,
    stage: payload.stage,
    progress: payload.progress,
  });
}

async function upsertInstalledPluginFromOperation(app: FastifyInstance, payload: z.infer<typeof PluginInstallProgressPayload>) {
  const operation = await app.prisma.operation.findUnique({ where: { id: payload.operationId } });
  const meta = operation?.metadata as
    | { name?: string; version?: string; author?: string; description?: string; category?: string; providerSlug?: string; providerProjectId?: string }
    | null;
  if (!payload.fileName) return;
  await app.prisma.installedPlugin.upsert({
    where: { serverId_fileName: { serverId: payload.serverId, fileName: payload.fileName } },
    update: {
      version: meta?.version ?? "unknown",
      fileSizeMb: payload.fileSizeMb ?? 0,
      checksumSha256: payload.checksumSha256,
      status: "ENABLED",
    },
    create: {
      id: ulid(),
      serverId: payload.serverId,
      name: meta?.name ?? payload.fileName.replace(/\.jar$/i, ""),
      version: meta?.version ?? "unknown",
      author: meta?.author ?? "Unknown",
      description: meta?.description ?? "",
      category: meta?.category ?? "utility",
      status: "ENABLED",
      fileSizeMb: payload.fileSizeMb ?? 0,
      fileName: payload.fileName,
      providerSlug: meta?.providerSlug,
      providerProjectId: meta?.providerProjectId,
      checksumSha256: payload.checksumSha256,
    },
  });
}
