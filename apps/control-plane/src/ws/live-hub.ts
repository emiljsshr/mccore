import fp from "fastify-plugin";
import type { WebSocket } from "ws";
import { WsClientMessageSchema, WS_EVENT_SCHEMAS, type WsEventEnvelope, type WsEventType } from "@mccore/contracts";
import { hasPermission, canAccessServer, loadSessionUser } from "../modules/auth/session-context.js";

interface LiveConnection { socket: WebSocket; userId: string; sessionId: string; channels: Set<string>; pending: number; queue: Promise<void>; }
export interface LiveHub { broadcast: (channel: string, type: WsEventType, resourceId: string, payload: unknown) => void; }
declare module "fastify" { interface FastifyInstance { liveHub: LiveHub; } }

export default fp(async function liveHubPlugin(app) {
  const connections = new Set<LiveConnection>();
  async function context(conn: LiveConnection) {
    const session = await app.prisma.session.findUnique({ where: { id: conn.sessionId } });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) { conn.socket.close(1008, "Session expired"); return null; }
    return loadSessionUser(app.prisma, conn.userId);
  }
  async function permitted(conn: LiveConnection, channel: string, type?: WsEventType, resourceId?: string) {
    const ctx = await context(conn);
    if (!ctx) return false;
    const [kind, id] = channel.split(":");
    if (kind === "server" && (!id || !hasPermission(ctx, "server.view") || !canAccessServer(ctx, id))) return false;
    if (kind === "node" && !hasPermission(ctx, "nodes.view")) return false;
    if (!["global", "server", "node"].includes(kind)) return false;
    if (type === "server.console" && !hasPermission(ctx, "console.view")) return false;
    if (type?.startsWith("node.") && !hasPermission(ctx, "nodes.view")) return false;
    if (type?.startsWith("server.") && (!hasPermission(ctx, "server.view") || !canAccessServer(ctx, resourceId!))) return false;
    return true;
  }
  function broadcast(channel: string, type: WsEventType, resourceId: string, payload: unknown) {
    const parsed = WS_EVENT_SCHEMAS[type].safeParse(payload);
    if (!parsed.success) { app.log.warn({ type }, "Invalid live event rejected"); return; }
    const envelope: WsEventEnvelope = { type, version: 1, timestamp: new Date().toISOString(), resourceId, payload: parsed.data };
    const frame = JSON.stringify(envelope);
    for (const conn of connections) {
      if (!conn.channels.has(channel)) continue;
      if (conn.pending > 100 || conn.socket.bufferedAmount > 1024 * 1024) { conn.socket.close(1013, "Client too slow"); continue; }
      conn.pending++;
      conn.queue = conn.queue.then(async () => {
        if (conn.socket.readyState !== conn.socket.OPEN) return;
        if (await permitted(conn, channel, type, resourceId)) conn.socket.send(frame);
      }).catch(err => { app.log.warn({ err }, "Live event delivery failed"); }).finally(() => { conn.pending--; });
    }
  }
  app.decorate("liveHub", { broadcast } satisfies LiveHub);
  app.get("/ws/live", { websocket: true, preHandler: app.authenticate }, (socket, request) => {
    if (!request.sessionId) { socket.close(1008, "Browser session required"); return; }
    const conn: LiveConnection = { socket, userId: request.user!.id, sessionId: request.sessionId, channels: new Set(), pending: 0, queue: Promise.resolve() };
    connections.add(conn);
    socket.on("message", raw => {
      void (async () => {
        if (raw.toString().length > 4096) { socket.close(1009); return; }
        const msg = WsClientMessageSchema.parse(JSON.parse(raw.toString()));
        if (msg.op === "ping") { if (await context(conn)) socket.send(JSON.stringify({ op: "pong" })); return; }
        if (msg.op === "unsubscribe") { conn.channels.delete(msg.channel); return; }
        if (conn.channels.size < 256 && await permitted(conn, msg.channel)) conn.channels.add(msg.channel);
      })().catch(() => { socket.close(1008, "Invalid subscription"); });
    });
    socket.on("close", () => { connections.delete(conn); });
  });
  app.addHook("onClose", async () => { for (const conn of connections) conn.socket.close(1001); connections.clear(); });
});
