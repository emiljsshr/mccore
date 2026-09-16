import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { ApiError, ErrorCode, ulid, MinecraftUsernameSchema, MinecraftUuidSchema } from "@mccore/contracts";
import type { MinecraftServer, OperatorEntry, Player, PlayerBan, PlayerSession, WhitelistEntry } from "@mccore/database";
import { recordAudit } from "../audit/service.js";
import { assertNoNewlines, isBanActive, toPlayerDto } from "./service.js";

function assertServerAccessible(request: FastifyRequest, serverId: string) {
  const ctx = request.user!;
  if (ctx.isSuperAdmin || ctx.serverIds === null || ctx.serverIds.includes(serverId)) return;
  throw new ApiError(ErrorCode.FORBIDDEN, "No access to this server.");
}

// NOTE: `await app.prisma.<model>.findX(...)` currently resolves to `any`
// under this repo's Prisma 7 client + TS 5.9 setup (reproducible even for a
// bare `prisma.minecraftServer.findFirst(...)`, and already visible in the
// pre-existing baseline, e.g. `nodes/service.ts`'s `nodes.map((n) => ...)`).
// Every Prisma call result in this file is explicitly annotated with its
// model type below to route around that rather than silently lose type
// safety in a module whose entire job is injection/traversal defense.
// This is an infrastructure-level issue (outside src/modules/players and
// src/modules/files) — flagged in the implementation report, not fixed here.

async function requireServer(app: FastifyInstance, id: string): Promise<MinecraftServer> {
  const server: MinecraftServer | null = await app.prisma.minecraftServer.findFirst({ where: { id, deletedAt: null } });
  if (!server) throw new ApiError(ErrorCode.SERVER_NOT_FOUND, "Server not found.");
  return server;
}

async function requirePlayer(app: FastifyInstance, uuid: string): Promise<{ player: Player; username: string }> {
  MinecraftUuidSchema.parse(uuid);
  const player: Player | null = await app.prisma.player.findUnique({ where: { uuid } });
  if (!player) throw new ApiError(ErrorCode.NOT_FOUND, "Player not found.");
  // Defense in depth: the username came from our own DB, not directly from
  // the client, but it costs nothing to re-validate before it's concatenated
  // into a console command string (DB data could in principle be stale or
  // corrupted from before this constraint existed).
  const username = MinecraftUsernameSchema.parse(player.username);
  return { player, username };
}

const KickBodySchema = z.object({ reason: z.string().max(512).optional() });
const BanBodySchema = z.object({ reason: z.string().max(512).optional(), expiresAt: z.string().datetime().optional() });
const WhitelistBodySchema = z.object({ action: z.enum(["add", "remove"]) });
const OpBodySchema = z.object({ action: z.enum(["op", "deop"]), level: z.number().int().min(1).max(4).default(4) });
const MessageBodySchema = z.object({ message: z.string().min(1).max(256) });

export default async function playersRoutes(app: FastifyInstance) {
  app.get("/api/v1/players", { preHandler: app.requirePermission("players.view") }, async request => {
    const scope = request.user!.serverIds;
    const scoped = scope === null ? {} : { serverId: { in: scope } };
    const players: Player[] = await app.prisma.player.findMany({ where: scope === null ? {} : { OR: [{ sessions: { some: scoped } }, { bans: { some: scoped } }, { whitelists: { some: scoped } }, { operators: { some: scoped } }] }, orderBy: { lastSeenAt: "desc" } });
    if (players.length === 0) return { players: [] };
    const playerIds = players.map((p) => p.id);

    const openSessions: PlayerSession[] = await app.prisma.playerSession.findMany({
      where: { playerId: { in: playerIds }, leftAt: null, ...scoped },
      orderBy: { joinedAt: "desc" },
    });
    const sessionByPlayer = new Map<string, (typeof openSessions)[number]>();
    for (const session of openSessions) {
      if (!sessionByPlayer.has(session.playerId)) sessionByPlayer.set(session.playerId, session);
    }
    const onlinePlayerIds = [...sessionByPlayer.keys()];
    const onlineServerIds = [...new Set([...sessionByPlayer.values()].map((s) => s.serverId))];

    // Ban/whitelist/operator status is inherently per-server (see the
    // schema — PlayerBan/WhitelistEntry/OperatorEntry all key on
    // serverId+playerId). For this *global* list we only have a server
    // context for players who are currently online, so we scope these
    // flags to a player's current server and leave offline players as
    // `false` here — callers that need the authoritative per-server
    // picture for an offline player should use `GET /players/:uuid`,
    // which returns a full `serverStatuses` breakdown. Judgment call.
    //
    // Queried sequentially (not Promise.all) rather than as a combined
    // multi-query — an empty `in: []` filter naturally returns no rows, so
    // this doesn't need a separate "any online players?" branch either.
    const now = new Date();
    const bans: PlayerBan[] = await app.prisma.playerBan.findMany({
      where: {
        playerId: { in: onlinePlayerIds },
        serverId: { in: onlineServerIds },
        pardonedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    const whitelists: WhitelistEntry[] = await app.prisma.whitelistEntry.findMany({
      where: { playerId: { in: onlinePlayerIds }, serverId: { in: onlineServerIds } },
    });
    const operators: OperatorEntry[] = await app.prisma.operatorEntry.findMany({
      where: { playerId: { in: onlinePlayerIds }, serverId: { in: onlineServerIds } },
    });

    const banByPair = new Map(bans.map((b) => [`${b.playerId}:${b.serverId}`, b]));
    const whitelistedPairs = new Set(whitelists.map((w) => `${w.playerId}:${w.serverId}`));
    const operatorPairs = new Set(operators.map((o) => `${o.playerId}:${o.serverId}`));

    const dtos = players.map((player) => {
      const session = sessionByPlayer.get(player.id);
      const key = session ? `${player.id}:${session.serverId}` : undefined;
      const ban = key ? banByPair.get(key) : undefined;
      return toPlayerDto(player, {
        online: !!session,
        serverId: session?.serverId,
        banned: !!ban,
        banReason: ban?.reason ?? undefined,
        bannedBy: ban?.bannedByUserId ?? undefined,
        whitelisted: key ? whitelistedPairs.has(key) : false,
        operator: key ? operatorPairs.has(key) : false,
      });
    });
    return { players: dtos };
  });

  app.get("/api/v1/servers/:id/players", { preHandler: app.requirePermission("players.view") }, async (request) => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);
    await requireServer(app, id);

    const sessions: (PlayerSession & { player: Player })[] = await app.prisma.playerSession.findMany({
      where: { serverId: id, leftAt: null },
      include: { player: true },
      orderBy: { joinedAt: "desc" },
    });
    const sessionByPlayer = new Map<string, (typeof sessions)[number]>();
    for (const session of sessions) {
      if (!sessionByPlayer.has(session.playerId)) sessionByPlayer.set(session.playerId, session);
    }
    const playerIds = [...sessionByPlayer.keys()];
    if (playerIds.length === 0) return { players: [] };

    // Queried sequentially rather than via Promise.all — see the comment in
    // the global players list handler above for why.
    const now = new Date();
    const bans: PlayerBan[] = await app.prisma.playerBan.findMany({
      where: { playerId: { in: playerIds }, serverId: id, pardonedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    });
    const whitelists: WhitelistEntry[] = await app.prisma.whitelistEntry.findMany({ where: { playerId: { in: playerIds }, serverId: id } });
    const operators: OperatorEntry[] = await app.prisma.operatorEntry.findMany({ where: { playerId: { in: playerIds }, serverId: id } });
    const banByPlayer = new Map(bans.map((b) => [b.playerId, b]));
    const whitelistedSet = new Set(whitelists.map((w) => w.playerId));
    const operatorSet = new Set(operators.map((o) => o.playerId));

    const dtos = [...sessionByPlayer.values()].map((session) => {
      const ban = banByPlayer.get(session.playerId);
      return toPlayerDto(session.player, {
        online: true,
        serverId: id,
        banned: !!ban,
        banReason: ban?.reason ?? undefined,
        bannedBy: ban?.bannedByUserId ?? undefined,
        whitelisted: whitelistedSet.has(session.playerId),
        operator: operatorSet.has(session.playerId),
      });
    });
    return { players: dtos };
  });

  app.get("/api/v1/players/:uuid", { preHandler: app.requirePermission("players.view") }, async (request) => {
    const { uuid } = request.params as { uuid: string };
    MinecraftUuidSchema.parse(uuid);
    const scope = request.user!.serverIds;
    const scoped = scope === null ? {} : { serverId: { in: scope } };
    const player: Player | null = await app.prisma.player.findUnique({ where: { uuid } });
    if (!player) throw new ApiError(ErrorCode.NOT_FOUND, "Player not found.");

    // Scope: servers this player has a session on, unioned with any server
    // where they currently have an explicit ban/whitelist/operator row even
    // without a recorded session (e.g. pre-whitelisted before their first
    // join). A strict "servers they've played on" reading would hide real
    // per-server admin state from the caller, so this broadens it slightly.
    // Judgment call. Queried sequentially rather than via Promise.all — see
    // the comment in the global players list handler above for why.
    const sessionServers: Array<{ serverId: string }> = await app.prisma.playerSession.findMany({
      where: { playerId: player.id, ...scoped },
      select: { serverId: true },
      distinct: ["serverId"],
    });
    const bans: PlayerBan[] = await app.prisma.playerBan.findMany({ where: { playerId: player.id, ...scoped } });
    const whitelists: WhitelistEntry[] = await app.prisma.whitelistEntry.findMany({ where: { playerId: player.id, ...scoped } });
    const operators: OperatorEntry[] = await app.prisma.operatorEntry.findMany({ where: { playerId: player.id, ...scoped } });

    const now = new Date();
    const activeBanByServer = new Map<string, (typeof bans)[number]>();
    for (const ban of bans) {
      if (!isBanActive(ban, now)) continue;
      const existing = activeBanByServer.get(ban.serverId);
      if (!existing || ban.bannedAt > existing.bannedAt) activeBanByServer.set(ban.serverId, ban);
    }
    const whitelistedServerIds = new Set(whitelists.map((w) => w.serverId));
    const operatorServerIds = new Set(operators.map((o) => o.serverId));

    const serverIds = new Set<string>([
      ...sessionServers.map((s) => s.serverId),
      ...activeBanByServer.keys(),
      ...whitelistedServerIds,
      ...operatorServerIds,
    ]);
    if (scope !== null && serverIds.size === 0) throw new ApiError(ErrorCode.NOT_FOUND, "Player not found.");
    const servers: MinecraftServer[] = await app.prisma.minecraftServer.findMany({ where: { id: { in: [...serverIds] } } });
    const serverNameById = new Map(servers.map((s) => [s.id, s.name]));

    const serverStatuses = [...serverIds].map((serverId) => ({
      serverId,
      serverName: serverNameById.get(serverId) ?? "Unknown server",
      banned: activeBanByServer.has(serverId),
      whitelisted: whitelistedServerIds.has(serverId),
      operator: operatorServerIds.has(serverId),
    }));

    const openSession: PlayerSession | null = await app.prisma.playerSession.findFirst({
      where: { playerId: player.id, leftAt: null, ...scoped },
      orderBy: { joinedAt: "desc" },
    });
    const currentBan = openSession ? activeBanByServer.get(openSession.serverId) : undefined;

    return {
      player: toPlayerDto(player, {
        online: !!openSession,
        serverId: openSession?.serverId,
        banned: !!currentBan,
        banReason: currentBan?.reason ?? undefined,
        bannedBy: currentBan?.bannedByUserId ?? undefined,
        whitelisted: openSession ? whitelistedServerIds.has(openSession.serverId) : false,
        operator: openSession ? operatorServerIds.has(openSession.serverId) : false,
      }),
      serverStatuses,
    };
  });

  app.post("/api/v1/servers/:id/players/:uuid/kick", { preHandler: app.requirePermission("players.kick") }, async (request) => {
    const { id, uuid } = request.params as { id: string; uuid: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app, id);
    const { username } = await requirePlayer(app, uuid);

    const { reason } = KickBodySchema.parse(request.body ?? {});
    if (reason) assertNoNewlines(reason, "reason");

    if (server.status !== "ONLINE") throw new ApiError(ErrorCode.SERVER_NOT_RUNNING, "Server is not running.");
    if (!app.agentHub.isConnected(server.nodeId)) throw new ApiError(ErrorCode.NODE_OFFLINE, "Node is not connected.");

    const command = `kick ${username}${reason ? ` ${reason}` : ""}`;
    const ack = await app.agentHub.sendCommand(server.nodeId, {
      commandId: ulid(),
      type: "console.command",
      issuedAt: new Date().toISOString(),
      payload: { serverId: id, command },
    });
    if (!ack.ok) throw new ApiError(ErrorCode.INTERNAL_ERROR, ack.errorMessage ?? "Kick command failed.");

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "player.kick",
      description: `${request.user!.name} kicked ${username} from "${server.name}".`,
      targetType: "player",
      targetLabel: username,
      serverId: id,
      severity: "INFO",
      ipAddress: request.ip,
      metadata: reason ? { reason } : undefined,
    });
    return { ok: true };
  });

  app.post("/api/v1/servers/:id/players/:uuid/ban", { preHandler: app.requirePermission("players.ban") }, async (request) => {
    const { id, uuid } = request.params as { id: string; uuid: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app, id);
    const { player, username } = await requirePlayer(app, uuid);

    const { reason, expiresAt } = BanBodySchema.parse(request.body ?? {});
    if (reason) assertNoNewlines(reason, "reason");

    // The DB row is the source of truth for enforcement — banned-players
    // data is regenerated from it by the agent at install/start time. The
    // live `ban` command below is best-effort and only attempted when the
    // node is actually reachable right now; it never blocks the ban itself.
    const existingActiveBan: PlayerBan | null = await app.prisma.playerBan.findFirst({
      where: { serverId: id, playerId: player.id, pardonedAt: null },
    });
    const banData = {
      reason: reason ?? null,
      bannedByUserId: request.user!.id,
      bannedAt: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      pardonedAt: null,
      pardonedByUserId: null,
    };
    if (existingActiveBan) {
      await app.prisma.playerBan.update({ where: { id: existingActiveBan.id }, data: banData });
    } else {
      await app.prisma.playerBan.create({ data: { id: ulid(), serverId: id, playerId: player.id, ...banData } });
    }

    if (server.status === "ONLINE" && app.agentHub.isConnected(server.nodeId)) {
      const command = `ban ${username}${reason ? ` ${reason}` : ""}`;
      try {
        const ack = await app.agentHub.sendCommand(server.nodeId, {
          commandId: ulid(),
          type: "console.command",
          issuedAt: new Date().toISOString(),
          payload: { serverId: id, command },
        });
        if (!ack.ok) {
          request.log.warn({ serverId: id, username, errorMessage: ack.errorMessage }, "live ban command failed; DB ban row is still authoritative");
        }
      } catch (err) {
        request.log.warn({ err, serverId: id, username }, "failed to send live ban command; DB ban row is still authoritative");
      }
    }

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "player.ban",
      description: `${request.user!.name} banned ${username} on "${server.name}".`,
      targetType: "player",
      targetLabel: username,
      serverId: id,
      severity: "WARNING",
      ipAddress: request.ip,
      metadata: { reason, expiresAt },
    });
    return { ok: true };
  });

  app.post("/api/v1/servers/:id/players/:uuid/pardon", { preHandler: app.requirePermission("players.ban") }, async (request) => {
    const { id, uuid } = request.params as { id: string; uuid: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app, id);
    const { player, username } = await requirePlayer(app, uuid);

    const activeBan: PlayerBan | null = await app.prisma.playerBan.findFirst({ where: { serverId: id, playerId: player.id, pardonedAt: null } });
    if (!activeBan) throw new ApiError(ErrorCode.NOT_FOUND, "No active ban found for this player on this server.");

    await app.prisma.playerBan.update({
      where: { id: activeBan.id },
      data: { pardonedAt: new Date(), pardonedByUserId: request.user!.id },
    });

    if (server.status === "ONLINE" && app.agentHub.isConnected(server.nodeId)) {
      try {
        const ack = await app.agentHub.sendCommand(server.nodeId, {
          commandId: ulid(),
          type: "console.command",
          issuedAt: new Date().toISOString(),
          payload: { serverId: id, command: `pardon ${username}` },
        });
        if (!ack.ok) {
          request.log.warn({ serverId: id, username, errorMessage: ack.errorMessage }, "live pardon command failed; DB row is still authoritative");
        }
      } catch (err) {
        request.log.warn({ err, serverId: id, username }, "failed to send live pardon command; DB row is still authoritative");
      }
    }

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "player.pardon",
      description: `${request.user!.name} pardoned ${username} on "${server.name}".`,
      targetType: "player",
      targetLabel: username,
      serverId: id,
      severity: "INFO",
      ipAddress: request.ip,
    });
    return { ok: true };
  });

  app.post("/api/v1/servers/:id/players/:uuid/whitelist", { preHandler: app.requirePermission("players.whitelist") }, async (request) => {
    const { id, uuid } = request.params as { id: string; uuid: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app, id);
    const { player, username } = await requirePlayer(app, uuid);
    const { action } = WhitelistBodySchema.parse(request.body);

    if (action === "add") {
      await app.prisma.whitelistEntry.upsert({
        where: { serverId_playerId: { serverId: id, playerId: player.id } },
        create: { id: ulid(), serverId: id, playerId: player.id, addedByUserId: request.user!.id },
        update: {},
      });
    } else {
      await app.prisma.whitelistEntry.deleteMany({ where: { serverId: id, playerId: player.id } });
    }

    if (server.status === "ONLINE" && app.agentHub.isConnected(server.nodeId)) {
      try {
        const ack = await app.agentHub.sendCommand(server.nodeId, {
          commandId: ulid(),
          type: "console.command",
          issuedAt: new Date().toISOString(),
          payload: { serverId: id, command: `whitelist ${action} ${username}` },
        });
        if (!ack.ok) {
          request.log.warn({ serverId: id, username, errorMessage: ack.errorMessage }, "live whitelist command failed; DB row is still authoritative");
        }
      } catch (err) {
        request.log.warn({ err, serverId: id, username }, "failed to send live whitelist command; DB row is still authoritative");
      }
    }

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: action === "add" ? "player.whitelist_add" : "player.whitelist_remove",
      description: `${request.user!.name} ${action === "add" ? "added" : "removed"} ${username} ${action === "add" ? "to" : "from"} the whitelist on "${server.name}".`,
      targetType: "player",
      targetLabel: username,
      serverId: id,
      severity: "INFO",
      ipAddress: request.ip,
    });
    return { ok: true };
  });

  app.post("/api/v1/servers/:id/players/:uuid/op", { preHandler: app.requirePermission("players.op") }, async (request) => {
    const { id, uuid } = request.params as { id: string; uuid: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app, id);
    const { player, username } = await requirePlayer(app, uuid);
    const { action, level } = OpBodySchema.parse(request.body);

    if (action === "op") {
      await app.prisma.operatorEntry.upsert({
        where: { serverId_playerId: { serverId: id, playerId: player.id } },
        create: { id: ulid(), serverId: id, playerId: player.id, level, addedByUserId: request.user!.id },
        update: { level, addedByUserId: request.user!.id, addedAt: new Date() },
      });
    } else {
      await app.prisma.operatorEntry.deleteMany({ where: { serverId: id, playerId: player.id } });
    }

    if (server.status === "ONLINE" && app.agentHub.isConnected(server.nodeId)) {
      try {
        const ack = await app.agentHub.sendCommand(server.nodeId, {
          commandId: ulid(),
          type: "console.command",
          issuedAt: new Date().toISOString(),
          payload: { serverId: id, command: `${action} ${username}` },
        });
        if (!ack.ok) {
          request.log.warn({ serverId: id, username, errorMessage: ack.errorMessage }, "live op command failed; DB row is still authoritative");
        }
      } catch (err) {
        request.log.warn({ err, serverId: id, username }, "failed to send live op command; DB row is still authoritative");
      }
    }

    // Judgment call: not specified by the spec, but granting/revoking
    // operator status is sensitive enough to warrant WARNING severity
    // (consistent with `player.ban` below) rather than plain INFO.
    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: action === "op" ? "player.op" : "player.deop",
      description: `${request.user!.name} ${action === "op" ? "granted operator status to" : "revoked operator status from"} ${username} on "${server.name}".`,
      targetType: "player",
      targetLabel: username,
      serverId: id,
      severity: "WARNING",
      ipAddress: request.ip,
    });
    return { ok: true };
  });

  app.post("/api/v1/servers/:id/players/:uuid/message", { preHandler: app.requirePermission("console.execute") }, async (request) => {
    const { id, uuid } = request.params as { id: string; uuid: string };
    assertServerAccessible(request, id);
    const server = await requireServer(app, id);
    const { username } = await requirePlayer(app, uuid);
    const { message } = MessageBodySchema.parse(request.body);

    // No JSON-encoding needed: Minecraft's `/tell <target> <message>` takes
    // everything after the target argument as literal message text — it is
    // not re-parsed as a command, so embedded quotes are just characters.
    // The only dangerous character here is a newline, which would start a
    // second, attacker-controlled line on the server process's stdin.
    assertNoNewlines(message, "message");

    if (server.status !== "ONLINE") throw new ApiError(ErrorCode.SERVER_NOT_RUNNING, "Server is not running.");
    if (!app.agentHub.isConnected(server.nodeId)) throw new ApiError(ErrorCode.NODE_OFFLINE, "Node is not connected.");

    const ack = await app.agentHub.sendCommand(server.nodeId, {
      commandId: ulid(),
      type: "console.command",
      issuedAt: new Date().toISOString(),
      payload: { serverId: id, command: `tell ${username} ${message}` },
    });
    if (!ack.ok) throw new ApiError(ErrorCode.INTERNAL_ERROR, ack.errorMessage ?? "Message command failed.");

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "player.message",
      description: `${request.user!.name} sent a message to ${username} on "${server.name}".`,
      targetType: "player",
      targetLabel: username,
      serverId: id,
      severity: "INFO",
      ipAddress: request.ip,
      metadata: { message },
    });
    return { ok: true };
  });
}
