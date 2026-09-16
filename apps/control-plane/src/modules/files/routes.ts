import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { ApiError, ErrorCode, ulid, RelativeServerPathSchema, FileEntryDtoSchema } from "@mccore/contracts";
import type { MinecraftServer } from "@mccore/database";
import { recordAudit } from "../audit/service.js";

function assertServerAccessible(request: FastifyRequest, serverId: string) {
  const ctx = request.user!;
  if (ctx.isSuperAdmin || ctx.serverIds === null || ctx.serverIds.includes(serverId)) return;
  throw new ApiError(ErrorCode.FORBIDDEN, "No access to this server.");
}

// NOTE: `await app.prisma.<model>.findX(...)` currently resolves to `any`
// under this repo's Prisma 7 client + TS 5.9 setup (reproducible even for a
// bare `prisma.minecraftServer.findFirst(...)`, and already visible in the
// pre-existing baseline, e.g. `nodes/service.ts`'s `nodes.map((n) => ...)`).
// `requireServer`'s result is explicitly annotated to route around that —
// see the longer note in `players/routes.ts`. Infrastructure-level issue,
// outside src/modules/players and src/modules/files — flagged in the
// implementation report, not fixed here.
async function requireServer(app: FastifyInstance, id: string): Promise<MinecraftServer> {
  const server: MinecraftServer | null = await app.prisma.minecraftServer.findFirst({ where: { id, deletedAt: null } });
  if (!server) throw new ApiError(ErrorCode.SERVER_NOT_FOUND, "Server not found.");
  return server;
}

function requireNodeConnected(app: FastifyInstance, server: { nodeId: string }) {
  // Files only exist on a connected node's disk — there is nothing sensible
  // to do with any file command if the agent isn't reachable.
  if (!app.agentHub.isConnected(server.nodeId)) {
    throw new ApiError(ErrorCode.NODE_OFFLINE, "The node this server runs on is not connected.");
  }
}

const KNOWN_ERROR_CODES = new Set<string>(Object.values(ErrorCode));

/** Maps a failed ack's `errorCode` onto our own `ErrorCode` enum where the
 * agent used one of our known codes (e.g. PATH_TRAVERSAL_REJECTED for a
 * traversal attempt caught by the agent's own SERVER_ROOT check), falling
 * back to INTERNAL_ERROR for anything else. */
function ackFailureCode(errorCode: string | undefined): ErrorCode {
  return errorCode && KNOWN_ERROR_CODES.has(errorCode) ? (errorCode as ErrorCode) : ErrorCode.INTERNAL_ERROR;
}

function assertAckOk(ack: { ok: boolean; errorCode?: string; errorMessage?: string }) {
  if (!ack.ok) throw new ApiError(ackFailureCode(ack.errorCode), ack.errorMessage ?? "File operation failed.");
}

/** True if a (schema-validated) path is the server root itself, in any of
 * its equivalent spellings ("", ".", "/", trailing slashes). */
function isServerRoot(rawPath: string): boolean {
  const normalized = rawPath.trim().replace(/\/+$/, "");
  return normalized === "" || normalized === "." || normalized === "/";
}

function extractPath(request: FastifyRequest): string | undefined {
  const fromBody = (request.body as { path?: string } | undefined)?.path;
  const fromQuery = (request.query as { path?: string } | undefined)?.path;
  return fromBody ?? fromQuery;
}

const FileListResultSchema = z.object({ entries: z.array(z.object({ name: z.string(), path: z.string(), isDir: z.boolean(), sizeBytes: z.number(), modifiedAt: z.string(), permissions: z.string() })) });
const FileReadResultSchema = z.object({ contentBase64: z.string() });
const WriteBodySchema = z.object({ path: z.string(), contentBase64: z.string() });
const MkdirBodySchema = z.object({ path: z.string() });
const RenameBodySchema = z.object({ path: z.string(), newPath: z.string() });

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export default async function filesRoutes(app: FastifyInstance) {
  app.get("/api/v1/servers/:id/files", { preHandler: app.requirePermission("files.view") }, async (request) => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app, id);
    requireNodeConnected(app, server);

    // Empty/missing path means "list the server root". RelativeServerPathSchema
    // requires min length 1 (it exists to reject traversal/absolute paths, not
    // to model "root"), so root is special-cased here rather than forcing
    // every caller to pass "." for the common no-subfolder case.
    const rawPath = (request.query as { path?: string } | undefined)?.path;
    const path = !rawPath ? "" : RelativeServerPathSchema.parse(rawPath);

    const ack = await app.agentHub.sendCommand(server.nodeId, {
      commandId: ulid(),
      type: "file.list",
      issuedAt: new Date().toISOString(),
      payload: { serverId: id, path },
    });
    assertAckOk(ack);

    // The agent owns entry metadata (size, mtime, permissions, kind
    // classification); we only do a light shape check on the way out so a
    // malformed agent response surfaces as a clear 500 instead of silently
    // reaching the client as something that merely looks like a FileEntryDto.
    const parsed = FileListResultSchema.safeParse(ack.result);
    if (!parsed.success) {
      request.log.error({ err: parsed.error, serverId: id, path }, "agent returned a malformed file.list result");
      throw new ApiError(ErrorCode.INTERNAL_ERROR, "Node returned an unexpected file listing.");
    }

    // Not logged to FileAuditEvent — only write/delete/rename/mkdir/
    // upload/download are audited, listing is too noisy to be useful.
    return { entries: parsed.data.entries.map(entry => {
      const extension = entry.name.split(".").pop()?.toLowerCase();
      const kind = entry.isDir ? "folder" : ["yaml", "json", "jar", "txt", "log", "zip", "properties"].includes(extension ?? "") ? extension : extension === "yml" ? "yaml" : "unknown";
      return FileEntryDtoSchema.parse({ ...entry, id: entry.path, serverId: id, path: entry.path.slice(0, -entry.name.length), kind, editable: !entry.isDir && ["yaml", "json", "txt", "log", "properties"].includes(kind ?? "") });
    }) };
  });

  app.get("/api/v1/servers/:id/files/content", { preHandler: app.requirePermission("files.view") }, async (request) => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app, id);
    requireNodeConnected(app, server);

    const rawPath = (request.query as { path?: string } | undefined)?.path;
    if (!rawPath) throw new ApiError(ErrorCode.VALIDATION_ERROR, "path is required.");
    const path = RelativeServerPathSchema.parse(rawPath);

    const ack = await app.agentHub.sendCommand(server.nodeId, {
      commandId: ulid(),
      type: "file.read",
      issuedAt: new Date().toISOString(),
      payload: { serverId: id, path },
    });
    assertAckOk(ack);

    const parsed = FileReadResultSchema.safeParse(ack.result);
    if (!parsed.success) {
      request.log.error({ err: parsed.error, serverId: id, path }, "agent returned a malformed file.read result");
      throw new ApiError(ErrorCode.INTERNAL_ERROR, "Node returned an unexpected file read result.");
    }

    await app.prisma.fileAuditEvent.create({
      data: { id: ulid(), serverId: id, userId: request.user!.id, action: "READ", path },
    });

    return parsed.data;
  });

  app.put("/api/v1/servers/:id/files/content", { preHandler: app.requirePermission("files.write") }, async (request) => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app, id);
    requireNodeConnected(app, server);

    const body = WriteBodySchema.parse(request.body);
    const path = RelativeServerPathSchema.parse(body.path);

    // The global Fastify body limit (10MB, see app.ts) caps the *raw*
    // request body, but base64 has ~33% overhead, so it doesn't precisely
    // cap the decoded file size, and the error it produces isn't a typed
    // FILE_TOO_LARGE the client can key off of. Check explicitly here too.
    const decoded = Buffer.from(body.contentBase64, "base64");
    if (decoded.byteLength > MAX_FILE_BYTES) {
      throw new ApiError(ErrorCode.FILE_TOO_LARGE, "File content must not exceed 10MB.");
    }

    const ack = await app.agentHub.sendCommand(server.nodeId, {
      commandId: ulid(),
      type: "file.write",
      issuedAt: new Date().toISOString(),
      payload: { serverId: id, path, contentBase64: body.contentBase64 },
    });
    assertAckOk(ack);

    await app.prisma.fileAuditEvent.create({
      data: { id: ulid(), serverId: id, userId: request.user!.id, action: "WRITE", path },
    });
    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "file.write",
      description: `${request.user!.name} edited "${path}" on "${server.name}".`,
      targetType: "file",
      targetLabel: path,
      serverId: id,
      severity: "INFO",
      ipAddress: request.ip,
    });

    return { ok: true };
  });

  app.post("/api/v1/servers/:id/files/mkdir", { preHandler: app.requirePermission("files.write") }, async (request) => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app, id);
    requireNodeConnected(app, server);

    const body = MkdirBodySchema.parse(request.body);
    const path = RelativeServerPathSchema.parse(body.path);

    const ack = await app.agentHub.sendCommand(server.nodeId, {
      commandId: ulid(),
      type: "file.mkdir",
      issuedAt: new Date().toISOString(),
      payload: { serverId: id, path },
    });
    assertAckOk(ack);

    await app.prisma.fileAuditEvent.create({
      data: { id: ulid(), serverId: id, userId: request.user!.id, action: "MKDIR", path },
    });
    return { ok: true };
  });

  app.post("/api/v1/servers/:id/files/rename", { preHandler: app.requirePermission("files.write") }, async (request) => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app, id);
    requireNodeConnected(app, server);

    const body = RenameBodySchema.parse(request.body);
    const path = RelativeServerPathSchema.parse(body.path);
    const newPath = RelativeServerPathSchema.parse(body.newPath);

    const ack = await app.agentHub.sendCommand(server.nodeId, {
      commandId: ulid(),
      type: "file.rename",
      issuedAt: new Date().toISOString(),
      payload: { serverId: id, path, newPath },
    });
    assertAckOk(ack);

    await app.prisma.fileAuditEvent.create({
      data: { id: ulid(), serverId: id, userId: request.user!.id, action: "RENAME", path: `${path} -> ${newPath}` },
    });
    return { ok: true };
  });

  app.delete("/api/v1/servers/:id/files", { preHandler: app.requirePermission("files.delete") }, async (request) => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app, id);
    requireNodeConnected(app, server);

    const rawPath = extractPath(request) ?? "";
    if (isServerRoot(rawPath)) {
      throw new ApiError(ErrorCode.PATH_TRAVERSAL_REJECTED, "Cannot delete the server root.");
    }
    const path = RelativeServerPathSchema.parse(rawPath);

    const ack = await app.agentHub.sendCommand(server.nodeId, {
      commandId: ulid(),
      type: "file.delete",
      issuedAt: new Date().toISOString(),
      payload: { serverId: id, path },
    });
    assertAckOk(ack);

    await app.prisma.fileAuditEvent.create({
      data: { id: ulid(), serverId: id, userId: request.user!.id, action: "DELETE", path },
    });
    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "file.delete",
      description: `${request.user!.name} deleted "${path}" on "${server.name}".`,
      targetType: "file",
      targetLabel: path,
      serverId: id,
      severity: "WARNING",
      ipAddress: request.ip,
    });

    return { ok: true };
  });
}
