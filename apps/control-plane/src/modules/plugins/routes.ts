import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ApiError, ErrorCode, ulid } from "@mccore/contracts";
import { assertServerAccessible, requireServer, tryAcquireServerLock } from "../servers/service.js";
import { toInstalledPluginDto } from "./service.js";
import { getPluginProvider } from "./providers/modrinth.js";
import { createOperation, toOperationDto } from "../operations/service.js";
import { recordAudit } from "../audit/service.js";

const InstallPluginSchema = z.object({
  providerSlug: z.literal("modrinth"),
  providerProjectId: z.string().min(1).max(64),
  versionId: z.string().min(1).max(64).optional(),
});

export default async function pluginsRoutes(app: FastifyInstance) {
  app.get("/api/v1/servers/:id/plugins", { preHandler: app.requirePermission("plugins.view") }, async (request) => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);
    const plugins = await app.prisma.installedPlugin.findMany({ where: { serverId: id }, orderBy: { installedAt: "desc" } });
    return { plugins: plugins.map(toInstalledPluginDto) };
  });

  app.get(
    "/api/v1/plugins/:providerSlug/:projectId/versions",
    { preHandler: app.requirePermission("plugins.view") },
    async (request) => {
      const { providerSlug, projectId } = request.params as { providerSlug: string; projectId: string };
      const { minecraftVersion, loader } = request.query as { minecraftVersion?: string; loader?: string };
      const provider = getPluginProvider(providerSlug);
      const versions = await provider.getVersions(projectId, { minecraftVersion, loader });
      return { versions };
    }
  );

  async function installOrUpdate(
    request: import("fastify").FastifyRequest,
    app: FastifyInstance,
    serverId: string,
    existingPluginId?: string
  ) {
    assertServerAccessible(request, serverId);
    const server = await requireServer(app.prisma, serverId);
    if (!app.agentHub.isConnected(server.nodeId)) throw new ApiError(ErrorCode.NODE_OFFLINE, "Node is not connected.");

    const existing = existingPluginId ? await app.prisma.installedPlugin.findFirst({ where: { id: existingPluginId, serverId } }) : null;
    if (existingPluginId && !existing) throw new ApiError(ErrorCode.NOT_FOUND, "Plugin not found.");
    const input = InstallPluginSchema.parse(request.body);
    if (existing && (existing.providerSlug !== input.providerSlug || existing.providerProjectId !== input.providerProjectId)) throw new ApiError(ErrorCode.VALIDATION_ERROR, "Update must use the installed plugin's project.");
    if (existing?.status === "DISABLED") throw new ApiError(ErrorCode.VALIDATION_ERROR, "Enable the plugin before updating it.");

    const provider = getPluginProvider(input.providerSlug);
    const project = await provider.getProject(input.providerProjectId);
    if (!project) throw new ApiError(ErrorCode.NOT_FOUND, "Plugin project not found.");

    const loader = server.software === "PAPER" || server.software === "PURPUR" ? "paper" : server.software.toLowerCase();
    const versions = await provider.getVersions(input.providerProjectId, { minecraftVersion: server.minecraftVersion, loader });
    const version = input.versionId ? versions.find((v) => v.versionId === input.versionId) : versions[0];
    if (!version) {
      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        `No compatible version found for Minecraft ${server.minecraftVersion} (${loader}).`
      );
    }

    const operation = await createOperation(app.prisma, {
      type: "PLUGIN_INSTALL",
      resourceId: existingPluginId ?? server.id,
      createdByUserId: request.user!.id,
      metadata: {
        name: project.name,
        version: version.versionNumber,
        author: project.author,
        description: project.description,
        category: project.category,
        providerSlug: project.providerSlug,
        providerProjectId: project.providerProjectId,
      },
    });

    const locked = await tryAcquireServerLock(app.prisma, server.id, operation.id);
    if (!locked) throw new ApiError(ErrorCode.SERVER_BUSY, "Another operation is already in progress for this server.");

    try {
      const ack = await app.agentHub.sendCommand(server.nodeId, {
        commandId: ulid(),
        type: "plugin.install",
        issuedAt: new Date().toISOString(),
        payload: {
          serverId: server.id,
          operationId: operation.id,
          downloadUrl: version.primaryFile.downloadUrl,
          expectedSha512: version.primaryFile.sha512,
          targetFileName: existing?.fileName ?? version.primaryFile.fileName,
        },
      });
      if (!ack.ok) throw new Error(ack.errorMessage ?? "Agent rejected the installation.");
    } catch (err) {
      await app.prisma.minecraftServer.update({ where: { id: server.id }, data: { lockedOperationId: null, lockedAt: null } });
      throw new ApiError(ErrorCode.NODE_UNAVAILABLE, `Node did not accept the plugin install command: ${(err as Error).message}`);
    }

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: existingPluginId ? "plugin.update" : "plugin.install",
      description: `${request.user!.name} ${existingPluginId ? "updated" : "installed"} plugin "${project.name}" on "${server.name}".`,
      targetType: "plugin",
      targetLabel: project.name,
      serverId: server.id,
      severity: "INFO",
      ipAddress: request.ip,
    });

    return { operation: toOperationDto(operation) };
  }

  app.post("/api/v1/servers/:id/plugins/install", { preHandler: app.requirePermission("plugins.install") }, async (request) => {
    const { id } = request.params as { id: string };
    return installOrUpdate(request, app, id);
  });

  app.post(
    "/api/v1/servers/:id/plugins/:pluginId/update",
    { preHandler: app.requirePermission("plugins.update") },
    async (request) => {
      const { id, pluginId } = request.params as { id: string; pluginId: string };
      return installOrUpdate(request, app, id, pluginId);
    }
  );

  app.patch("/api/v1/servers/:id/plugins/:pluginId/status", { preHandler: app.requirePermission("plugins.update") }, async request => {
    const { id, pluginId } = request.params as { id: string; pluginId: string };
    assertServerAccessible(request, id);
    const { status } = z.object({ status: z.enum(["enabled", "disabled"]) }).parse(request.body);
    const server = await requireServer(app.prisma, id);
    if (server.status !== "OFFLINE") throw new ApiError(ErrorCode.VALIDATION_ERROR, "Stop the server before enabling or disabling plugins.");
    const plugin = await app.prisma.installedPlugin.findFirst({ where: { id: pluginId, serverId: id } });
    if (!plugin) throw new ApiError(ErrorCode.NOT_FOUND, "Plugin not found.");
    if (plugin.status.toLowerCase() === status) return { plugin: toInstalledPluginDto(plugin) };
    if (!app.agentHub.isConnected(server.nodeId)) throw new ApiError(ErrorCode.NODE_OFFLINE, "Node is not connected.");
    const lockId = ulid();
    if (!await tryAcquireServerLock(app.prisma, id, lockId)) throw new ApiError(ErrorCode.SERVER_BUSY, "Server has an operation in progress.");
    try {
      const fileName = status === "disabled" ? plugin.fileName + ".disabled" : plugin.fileName.replace(/\.disabled$/, "");
      const ack = await app.agentHub.sendCommand(server.nodeId, {
        commandId: ulid(), type: "file.rename", issuedAt: new Date().toISOString(),
        payload: { serverId: id, path: "plugins/" + plugin.fileName, newPath: "plugins/" + fileName },
      });
      if (!ack.ok) throw new ApiError(ErrorCode.NODE_UNAVAILABLE, ack.errorMessage ?? "Could not change plugin status.");
      const updated = await app.prisma.installedPlugin.update({ where: { id: pluginId }, data: { status: status === "enabled" ? "ENABLED" : "DISABLED", fileName } });
      return { plugin: toInstalledPluginDto(updated) };
    } finally {
      await app.prisma.minecraftServer.updateMany({ where: { id, lockedOperationId: lockId }, data: { lockedOperationId: null, lockedAt: null } });
    }
  });

  app.delete("/api/v1/servers/:id/plugins/:pluginId", { preHandler: app.requirePermission("plugins.delete") }, async (request) => {
    const { id, pluginId } = request.params as { id: string; pluginId: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app.prisma, id);
    const plugin = await app.prisma.installedPlugin.findFirst({ where: { id: pluginId, serverId: id } });
    if (!plugin) throw new ApiError(ErrorCode.NOT_FOUND, "Plugin not found.");

    if (!app.agentHub.isConnected(server.nodeId)) throw new ApiError(ErrorCode.NODE_OFFLINE, "Node is not connected.");
    const ack = await app.agentHub.sendCommand(server.nodeId, {
      commandId: ulid(), type: "plugin.delete", issuedAt: new Date().toISOString(),
      payload: { serverId: id, fileName: plugin.fileName },
    });
    if (!ack.ok) throw new ApiError(ErrorCode.NODE_UNAVAILABLE, ack.errorMessage ?? "Plugin could not be removed.");
    await app.prisma.installedPlugin.delete({ where: { id: pluginId } });

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "plugin.delete",
      description: `${request.user!.name} removed plugin "${plugin.name}" from "${server.name}".`,
      targetType: "plugin",
      targetLabel: plugin.name,
      serverId: id,
      severity: "WARNING",
      ipAddress: request.ip,
    });
    return { ok: true };
  });
}
