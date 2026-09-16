import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import nacl from "tweetnacl";
import { ulid } from "@mccore/contracts";
import type { AgentCommand, AgentAck, AgentHandshake } from "@mccore/contracts";
import { AgentHandshakeSchema, AgentInboundFrameSchema } from "@mccore/contracts";
import { dispatchAgentEvent } from "../modules/nodes/event-dispatcher.js";
import { applyHeartbeat } from "../modules/nodes/heartbeat.js";

interface AgentConnection {
  nodeId: string;
  socket: WebSocket;
  lastSeq: number;
}

interface PendingCommand {
  nodeId: string;
  resolve: (ack: AgentAck) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export interface AgentHub {
  isConnected: (nodeId: string) => boolean;
  sendCommand: (nodeId: string, command: AgentCommand, timeoutMs?: number) => Promise<AgentAck>;
}

declare module "fastify" {
  interface FastifyInstance {
    agentHub: AgentHub;
  }
}

const HANDSHAKE_TIMEOUT_MS = 10_000;
const DEFAULT_COMMAND_TIMEOUT_MS = 30_000;

/**
 * Agent ⇄ Control Plane channel (§4, §17, §42). Auth is the Ed25519
 * handshake described in docs/architecture.md §2 — there is no bearer
 * token, no shared secret, and no way to reach this socket's command
 * surface without possessing the node's private key.
 */
export default fp(async function agentHubPlugin(app: FastifyInstance) {
  const connections = new Map<string, AgentConnection>();
  const pending = new Map<string, PendingCommand>();

  function isConnected(nodeId: string) {
    return connections.has(nodeId);
  }

  function sendCommand(nodeId: string, command: AgentCommand, timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS): Promise<AgentAck> {
    const conn = connections.get(nodeId);
    if (!conn || conn.socket.readyState !== conn.socket.OPEN) {
      return Promise.reject(Object.assign(new Error("Node is not connected."), { code: "NODE_OFFLINE" }));
    }
    return new Promise<AgentAck>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(command.commandId);
        reject(Object.assign(new Error("Agent command timed out."), { code: "NODE_UNAVAILABLE" }));
      }, timeoutMs);
      pending.set(command.commandId, { nodeId, resolve, reject, timer });
      conn.socket.send(JSON.stringify({ kind: "command", command }));
    });
  }

  app.decorate("agentHub", { isConnected, sendCommand } satisfies AgentHub);

  async function verifyHandshake(handshake: AgentHandshake): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
    if (handshake.protocolVersion !== app.config.agentProtocolVersion) {
      return { ok: false, code: "AGENT_PROTOCOL_INCOMPATIBLE", message: "Agent protocol version is not supported by this Control Plane." };
    }
    const skew = Math.abs(Date.now() - handshake.timestamp);
    if (skew > app.config.agentHandshakeWindowMs) {
      return { ok: false, code: "AGENT_AUTH_INVALID", message: "Handshake timestamp outside the allowed window." };
    }

    const node = await app.prisma.node.findUnique({ where: { id: handshake.nodeId } });
    if (!node) return { ok: false, code: "AGENT_AUTH_INVALID", message: "Unknown node." };

    const credentials = await app.prisma.nodeCredential.findMany({ where: { nodeId: node.id, isActive: true } });
    if (credentials.length === 0) return { ok: false, code: "AGENT_AUTH_INVALID", message: "No active credentials for this node." };

    const message = new TextEncoder().encode(`${handshake.nodeId}.${handshake.timestamp}.${handshake.nonce}`);
    let signatureValid = false;
    let signatureBytes: Uint8Array;
    try {
      signatureBytes = Buffer.from(handshake.signature, "base64");
    } catch {
      return { ok: false, code: "AGENT_AUTH_INVALID", message: "Malformed signature." };
    }
    for (const cred of credentials) {
      const publicKey = Buffer.from(cred.publicKey, "base64");
      if (nacl.sign.detached.verify(message, signatureBytes, publicKey)) {
        signatureValid = true;
        break;
      }
    }
    if (!signatureValid) return { ok: false, code: "AGENT_AUTH_INVALID", message: "Signature verification failed." };

    try {
      await app.prisma.agentNonce.create({ data: { id: ulid(), nodeId: node.id, nonce: handshake.nonce } });
    } catch {
      return { ok: false, code: "AGENT_AUTH_INVALID", message: "Nonce already used (replay detected)." };
    }

    return { ok: true };
  }

  app.get("/ws/agent", { websocket: true }, (socket, request) => {
    let handshakeDone = false;
    let nodeId: string | undefined;

    const handshakeTimer = setTimeout(() => {
      if (!handshakeDone) socket.close(4001, "Handshake timeout");
    }, HANDSHAKE_TIMEOUT_MS);

    let queue = Promise.resolve();
    socket.on("message", (raw: Buffer) => {
      queue = queue.then(async () => {
        if (!handshakeDone) {
          clearTimeout(handshakeTimer);
          let handshake: AgentHandshake;
          try {
            handshake = AgentHandshakeSchema.parse(JSON.parse(raw.toString()));
          } catch {
            socket.close(4002, "Malformed handshake");
            return;
          }
          const result = await verifyHandshake(handshake);
          if (!result.ok) {
            socket.send(JSON.stringify({ kind: "handshake_error", errorCode: result.code, errorMessage: result.message }));
            request.log.warn({ nodeId: handshake.nodeId, code: result.code }, "agent handshake rejected");
            socket.close(4003, result.code);
            return;
          }

          handshakeDone = true;
          nodeId = handshake.nodeId;
          connections.get(nodeId)?.socket.close(4000, "Replaced by a new connection");
          connections.set(nodeId, { nodeId, socket, lastSeq: 0 });
          await app.prisma.node.update({
            where: { id: nodeId },
            data: { status: "HEALTHY", agentVersion: handshake.agentVersion, protocolVersion: handshake.protocolVersion, lastHeartbeatAt: new Date() },
          });
          app.liveHub.broadcast(`node:${nodeId}`, "node.status", nodeId, { status: "healthy" });
          socket.send(JSON.stringify({ kind: "handshake_ack", nodeId }));
          return;
        }

        if (!nodeId) return;
        let frame;
        try {
          frame = AgentInboundFrameSchema.parse(JSON.parse(raw.toString()));
        } catch (err) {
          request.log.warn({ err, nodeId }, "malformed agent frame");
          return;
        }

        if (frame.kind === "ack") {
          const p = pending.get(frame.commandId);
          if (p && p.nodeId === nodeId && connections.get(nodeId)?.socket === socket) {
            clearTimeout(p.timer);
            pending.delete(frame.commandId);
            p.resolve(frame);
          }
          return;
        }

        if (frame.nodeId !== nodeId || connections.get(nodeId)?.socket !== socket) { socket.close(4003, "Node identity mismatch"); return; }
        if (frame.kind === "heartbeat") {
          await applyHeartbeat(app, frame);
          return;
        }

        if (frame.kind === "event") {
          const conn = connections.get(nodeId);
          if (conn) {
            if (frame.seq <= conn.lastSeq) {
              request.log.warn({ nodeId, seq: frame.seq, lastSeq: conn.lastSeq }, "rejected non-increasing agent event seq (possible replay)");
              return;
            }
            conn.lastSeq = frame.seq;
          }
          const serverId = (frame.payload as { serverId?: unknown })?.serverId;
          if (typeof serverId !== "string" || !await app.prisma.minecraftServer.findFirst({ where: { id: serverId, nodeId } })) {
            request.log.warn({ nodeId }, "Rejected event for a server on another node"); return;
          }
          await dispatchAgentEvent(app, frame);
        }
      }).catch(err => { request.log.warn({ err, nodeId }, "Agent frame rejected"); socket.close(4003, "Invalid agent frame"); });
    });

    socket.on("close", () => {
      clearTimeout(handshakeTimer);
      if (nodeId && connections.get(nodeId)?.socket === socket) {
        connections.delete(nodeId);
        void app.prisma.node
          .update({ where: { id: nodeId }, data: { status: "OFFLINE" } })
          .then(() => app.liveHub.broadcast(`node:${nodeId}`, "node.status", nodeId!, { status: "offline" }))
          .catch((err: unknown) => request.log.error({ err, nodeId }, "failed to mark node offline"));
        // Any command still awaiting an ack from this connection can never
        // complete — fail fast instead of leaving callers hanging until
        // their timeout.
        for (const [commandId, p] of pending) {
          if (p.nodeId !== nodeId) continue;
          clearTimeout(p.timer);
          pending.delete(commandId);
          p.reject(Object.assign(new Error("Node disconnected."), { code: "NODE_OFFLINE" }));
        }
      }
    });
  });
});
