import { consoleHistory } from "./console-history.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma } from "@mccore/database";
import { ApiError, ErrorCode, ulid, CreateServerInputSchema } from "@mccore/contracts";
import type { AgentCommand } from "@mccore/contracts";
import { toServerDto, tryAcquireServerLock } from "./service.js";
import { createOperation, toOperationDto } from "../operations/service.js";
import { recordAudit } from "../audit/service.js";
import { withIdempotency } from "../../lib/idempotency.js";

const EULA_VERSION = "2024-01";

function assertServerAccessible(request: import("fastify").FastifyRequest, serverId: string) {
  const ctx = request.user!;
  if (ctx.isSuperAdmin || ctx.serverIds === null || ctx.serverIds.includes(serverId)) return;
  throw new ApiError(ErrorCode.FORBIDDEN, "No access to this server.");
}

async function requireServer(app: FastifyInstance, id: string) {
  const server = await app.prisma.minecraftServer.findFirst({ where: { id, deletedAt: null } });
  if (!server) throw new ApiError(ErrorCode.SERVER_NOT_FOUND, "Server not found.");
  return server;
}

async function dispatchLifecycleCommand(
  app: FastifyInstance,
  server: { id: string; nodeId: string },
  operationType: string,
  command: AgentCommand,
  transitionalStatus: "STARTING" | "STOPPING" | "RESTARTING"
) {
  if (!app.agentHub.isConnected(server.nodeId)) {
    throw new ApiError(ErrorCode.NODE_OFFLINE, "The node this server runs on is not connected.");
  }
  const operation = await createOperation(app.prisma, { type: operationType, resourceId: server.id });
  const locked = await tryAcquireServerLock(app.prisma, server.id, operation.id);
  if (!locked) throw new ApiError(ErrorCode.SERVER_BUSY, "Another operation is already in progress for this server.");

  await app.prisma.minecraftServer.update({ where: { id: server.id }, data: { status: transitionalStatus } });
  app.liveHub.broadcast(`server:${server.id}`, "server.status", server.id, { status: transitionalStatus.toLowerCase() });

  try {
    const ack = await app.agentHub.sendCommand(server.nodeId, command);
    if (!ack.ok) throw new ApiError(ErrorCode.SERVER_BUSY, ack.errorMessage ?? "Agent rejected the command.");
  } catch (err) {
    await app.prisma.minecraftServer.update({ where: { id: server.id }, data: { lockedOperationId: null, lockedAt: null } });
    throw err;
  }
  return operation;
}

export default async function serversRoutes(app: FastifyInstance) {
  app.get("/api/v1/server-software/versions", { preHandler: app.requirePermission("server.create") }, async request => {
    const { nodeId, software } = z.object({ nodeId: z.string().min(1), software: z.enum(["paper", "purpur", "vanilla", "velocity"]) }).parse(request.query);
    if (!app.agentHub.isConnected(nodeId)) throw new ApiError(ErrorCode.NODE_OFFLINE, "Select a connected node to load versions.");
    const ack = await app.agentHub.sendCommand(nodeId, { commandId: ulid(), type: "software.versions", issuedAt: new Date().toISOString(), payload: { software } });
    if (!ack.ok) throw new ApiError(ErrorCode.NODE_UNAVAILABLE, ack.errorMessage ?? "Could not load versions.");
    return z.object({ versions: z.array(z.string()) }).parse(ack.result);
  });

  app.get("/api/v1/servers/:id/console", { preHandler: app.requirePermission("console.view") }, async request => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id); await requireServer(app, id);
    return { lines: consoleHistory(app, id) };
  });
  app.get("/api/v1/servers", { preHandler: app.requirePermission("server.view") }, async (request) => {
    const ctx = request.user!;
    const where = ctx.isSuperAdmin || ctx.serverIds === null ? { deletedAt: null } : { deletedAt: null, id: { in: ctx.serverIds } };
    const servers = await app.prisma.minecraftServer.findMany({ where, orderBy: { createdAt: "desc" } });
    return { servers: servers.map(toServerDto) };
  });

  app.get("/api/v1/servers/:id", { preHandler: app.requirePermission("server.view") }, async (request) => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app, id);
    return { server: toServerDto(server) };
  });

  app.patch("/api/v1/servers/:id", { preHandler: app.requirePermission("server.create") }, async request => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app, id);
    if (server.status !== "OFFLINE") throw new ApiError(ErrorCode.CONFLICT, "Stop the server before changing its configuration.");
    const schema = CreateServerInputSchema.pick({ name: true, description: true, icon: true, maxPlayers: true, gameMode: true, difficulty: true, onlineMode: true, whitelist: true, pvp: true, commandBlocks: true, memoryMaxMb: true, cpuLimitPercent: true, motd: true });
    const input = schema.parse(request.body);
    if (input.memoryMaxMb < server.memoryMinMb) throw new ApiError(ErrorCode.VALIDATION_ERROR, "Maximum memory must be at least the server minimum.");
    const lockId = ulid();
    if (!await tryAcquireServerLock(app.prisma, id, lockId)) throw new ApiError(ErrorCode.SERVER_BUSY, "Another operation is running.");
    try {
      const ack = await app.agentHub.sendCommand(server.nodeId, { commandId: ulid(), type: "server.configure", issuedAt: new Date().toISOString(), payload: { serverId: id, software: server.software.toLowerCase() as import("@mccore/contracts").MinecraftSoftwareDto, minecraftVersion: server.minecraftVersion, javaSelector: server.javaVersion, memoryMinMb: server.memoryMinMb, diskLimitMb: server.diskLimitMb, port: server.port, ...input } });
      if (!ack.ok) throw new ApiError(ErrorCode.CONFLICT, ack.errorMessage ?? "Node rejected configuration.");
      const updated = await app.prisma.minecraftServer.update({ where: { id }, data: { ...input, gameMode: input.gameMode.toUpperCase() as typeof server.gameMode, difficulty: input.difficulty.toUpperCase() as typeof server.difficulty } });
      await recordAudit(app.prisma, { actorUserId: request.user!.id, action: "server.configured", description: "Updated server configuration.", serverId: id, ipAddress: request.ip });
      return { server: toServerDto(updated) };
    } finally { await app.prisma.minecraftServer.updateMany({ where: { id, lockedOperationId: lockId }, data: { lockedOperationId: null, lockedAt: null } }); }
  });

  app.post("/api/v1/servers", { preHandler: app.requirePermission("server.create") }, async (request, reply) => {
    return withIdempotency(app.prisma, request, reply, async () => {
      const input = CreateServerInputSchema.parse(request.body);
      if (!["paper", "purpur", "vanilla", "velocity"].includes(input.software)) throw new ApiError(ErrorCode.VALIDATION_ERROR, "This agent does not yet support the selected software.");

      const node = await app.prisma.node.findUnique({ where: { id: input.nodeId } });
      if (!node) throw new ApiError(ErrorCode.NODE_NOT_FOUND, "Node not found.");
      if (!app.agentHub.isConnected(node.id)) throw new ApiError(ErrorCode.NODE_OFFLINE, "The selected node is not connected.");

      const conflict = await app.prisma.serverAllocation.findFirst({
        where: { nodeId: node.id, ip: node.ipAddress, port: input.port, protocol: "TCP" },
      });
      if (conflict) throw new ApiError(ErrorCode.PORT_ALREADY_ALLOCATED, `Port ${input.port} is already in use on this node.`);

      const serverId = ulid();
      const server = await app.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const created = await tx.minecraftServer.create({
          data: {
            id: serverId,
            name: input.name,
            description: input.description,
            icon: input.icon,
            status: "INSTALLING",
            software: input.software.toUpperCase() as never,
            minecraftVersion: input.minecraftVersion,
            build: input.build,
            javaVersion: "",
            nodeId: node.id,
            host: node.ipAddress,
            port: input.port,
            maxPlayers: input.maxPlayers,
            memoryMinMb: input.memoryMinMb,
            memoryMaxMb: input.memoryMaxMb,
            cpuLimitPercent: input.cpuLimitPercent,
            diskLimitMb: input.diskLimitMb,
            difficulty: input.difficulty.toUpperCase() as never,
            gameMode: input.gameMode.toUpperCase() as never,
            onlineMode: input.onlineMode,
            whitelist: input.whitelist,
            pvp: input.pvp,
            commandBlocks: input.commandBlocks,
            motd: input.motd,
            serverDirectory: serverId,
            autoStart: false,
            autoRestart: true,
          },
        });
        await tx.serverAllocation.create({ data: { id: ulid(), nodeId: node.id, ip: node.ipAddress, port: input.port, protocol: "TCP", serverId } });
        await tx.eulaAcceptance.create({ data: { id: ulid(), userId: request.user!.id, serverId, eulaVersion: EULA_VERSION } });
        if (input.software !== "velocity") {
          // Every non-proxy server starts with a default "world" directory
          // (§37) — real size/seed introspection lands once the agent can
          // report level.dat metadata; see modules/worlds/routes.ts.
          await tx.world.create({
            data: {
              id: ulid(),
              serverId,
              name: "world",
              directoryName: "world",
              environment: "overworld",
              difficulty: input.difficulty.toUpperCase() as never,
              gameMode: input.gameMode.toUpperCase() as never,
            },
          });
        }
        return created;
      });

      const operation = await createOperation(app.prisma, { type: "SERVER_INSTALL", resourceId: server.id, createdByUserId: request.user!.id });
      await app.prisma.minecraftServer.update({ where: { id: server.id }, data: { lockedOperationId: operation.id, lockedAt: new Date() } });

      const command: AgentCommand = {
        commandId: operation.id,
        type: "server.install",
        issuedAt: new Date().toISOString(),
        payload: {
          serverId: server.id,
          software: input.software,
          minecraftVersion: input.minecraftVersion,
          build: input.build,
          // Left empty deliberately: the Agent derives the correct Java
          // major version from `minecraftVersion` itself (§24 — it's the
          // one that actually knows what's installed on the node), rather
          // than the Control Plane guessing at server-creation time.
          javaSelector: "",
          memoryMinMb: input.memoryMinMb,
          memoryMaxMb: input.memoryMaxMb,
          cpuLimitPercent: input.cpuLimitPercent,
          diskLimitMb: input.diskLimitMb,
          port: input.port,
          maxPlayers: input.maxPlayers,
          gameMode: input.gameMode,
          difficulty: input.difficulty,
          onlineMode: input.onlineMode,
          whitelist: input.whitelist,
          pvp: input.pvp,
          commandBlocks: input.commandBlocks,
          motd: input.motd,
          eulaAccepted: true,
          autoStart: false,
        },
      };

      try {
        const ack = await app.agentHub.sendCommand(node.id, command, 15_000);
        if (!ack.ok) throw new Error(ack.errorMessage ?? "Agent rejected installation.");
      } catch (err) {
        await app.prisma.minecraftServer.update({ where: { id: server.id }, data: { status: "ERROR", lockedOperationId: null, lockedAt: null } });
        throw new ApiError(ErrorCode.NODE_UNAVAILABLE, `Node did not accept the install command: ${(err as Error).message}`);
      }

      await recordAudit(app.prisma, {
        actorUserId: request.user!.id,
        action: "server.created",
        description: `${request.user!.name} created server "${server.name}".`,
        targetType: "server",
        targetLabel: server.name,
        serverId: server.id,
        severity: "SUCCESS",
        ipAddress: request.ip,
      });

      return { server: toServerDto(server), operation: toOperationDto(operation) };
    });
  });

  app.delete("/api/v1/servers/:id", { preHandler: app.requirePermission("server.delete") }, async (request) => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app, id);
    if (server.status === "ONLINE" || server.status === "STARTING") {
      throw new ApiError(ErrorCode.CONFLICT, "Stop the server before deleting it.");
    }
    const deleteFiles = (request.query as { deleteFiles?: string }).deleteFiles === "true";

    await app.prisma.minecraftServer.update({ where: { id }, data: { deletedAt: new Date() } });
    if (app.agentHub.isConnected(server.nodeId)) {
      await app.agentHub
        .sendCommand(server.nodeId, {
          commandId: ulid(),
          type: "server.delete",
          issuedAt: new Date().toISOString(),
          payload: { serverId: id, deleteFiles },
        })
        .catch((err) => request.log.warn({ err, serverId: id }, "server.delete command failed"));
    }

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "server.deleted",
      description: `${request.user!.name} deleted server "${server.name}".`,
      targetType: "server",
      targetLabel: server.name,
      serverId: server.id,
      severity: "WARNING",
      ipAddress: request.ip,
    });
    return { ok: true };
  });

  app.post("/api/v1/servers/:id/start", { preHandler: app.requirePermission("server.start") }, async (request) => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app, id);
    if (server.status === "ONLINE") throw new ApiError(ErrorCode.SERVER_ALREADY_RUNNING, "Server is already running.");

    const operation = await dispatchLifecycleCommand(
      app,
      server,
      "SERVER_START",
      { commandId: ulid(), type: "server.start", issuedAt: new Date().toISOString(), payload: { serverId: id } },
      "STARTING"
    );
    await recordAudit(app.prisma, { actorUserId: request.user!.id, action: "server.start", description: `${request.user!.name} started "${server.name}".`, targetType: "server", serverId: id, severity: "INFO", ipAddress: request.ip });
    return { operation: toOperationDto(operation) };
  });

  const StopBodySchema = z.object({ gracePeriodSeconds: z.number().int().min(0).max(600).default(30) });

  app.post("/api/v1/servers/:id/stop", { preHandler: app.requirePermission("server.stop") }, async (request) => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app, id);
    if (server.status === "OFFLINE") throw new ApiError(ErrorCode.SERVER_NOT_RUNNING, "Server is not running.");
    const { gracePeriodSeconds } = StopBodySchema.parse(request.body ?? {});

    const operation = await dispatchLifecycleCommand(
      app,
      server,
      "SERVER_STOP",
      { commandId: ulid(), type: "server.stop", issuedAt: new Date().toISOString(), payload: { serverId: id, gracePeriodSeconds } },
      "STOPPING"
    );
    await recordAudit(app.prisma, { actorUserId: request.user!.id, action: "server.stop", description: `${request.user!.name} stopped "${server.name}".`, targetType: "server", serverId: id, severity: "INFO", ipAddress: request.ip });
    return { operation: toOperationDto(operation) };
  });

  app.post("/api/v1/servers/:id/restart", { preHandler: app.requirePermission("server.restart") }, async (request) => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app, id);
    const { gracePeriodSeconds } = StopBodySchema.parse(request.body ?? {});

    const operation = await dispatchLifecycleCommand(
      app,
      server,
      "SERVER_RESTART",
      { commandId: ulid(), type: "server.restart", issuedAt: new Date().toISOString(), payload: { serverId: id, gracePeriodSeconds } },
      "RESTARTING"
    );
    await recordAudit(app.prisma, { actorUserId: request.user!.id, action: "server.restart", description: `${request.user!.name} restarted "${server.name}".`, targetType: "server", serverId: id, severity: "INFO", ipAddress: request.ip });
    return { operation: toOperationDto(operation) };
  });

  app.post("/api/v1/servers/:id/kill", { preHandler: app.requirePermission("server.kill") }, async (request) => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app, id);

    const operation = await dispatchLifecycleCommand(
      app,
      server,
      "SERVER_STOP",
      { commandId: ulid(), type: "server.kill", issuedAt: new Date().toISOString(), payload: { serverId: id } },
      "STOPPING"
    );
    await recordAudit(app.prisma, { actorUserId: request.user!.id, action: "server.kill", description: `${request.user!.name} force-killed "${server.name}".`, targetType: "server", serverId: id, severity: "WARNING", ipAddress: request.ip });
    return { operation: toOperationDto(operation) };
  });

  const ConsoleCommandSchema = z.object({ command: z.string().min(1).max(2000) });

  app.post("/api/v1/servers/:id/console/command", { preHandler: app.requirePermission("console.execute") }, async (request) => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app, id);
    if (server.status !== "ONLINE") throw new ApiError(ErrorCode.SERVER_NOT_RUNNING, "Server is not running.");
    const { command } = ConsoleCommandSchema.parse(request.body);

    if (!app.agentHub.isConnected(server.nodeId)) throw new ApiError(ErrorCode.NODE_OFFLINE, "Node is not connected.");
    const ack = await app.agentHub.sendCommand(server.nodeId, {
      commandId: ulid(),
      type: "console.command",
      issuedAt: new Date().toISOString(),
      payload: { serverId: id, command },
    });
    if (!ack.ok) throw new ApiError(ErrorCode.INTERNAL_ERROR, ack.errorMessage ?? "Command failed.");

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "console.command",
      description: `${request.user!.name} ran a console command on "${server.name}".`,
      targetType: "server",
      serverId: id,
      severity: "INFO",
      ipAddress: request.ip,
      metadata: { command },
    });
    return { ok: true };
  });
}
