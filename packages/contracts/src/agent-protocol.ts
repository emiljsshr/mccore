import { z } from "zod";
import { MinecraftSoftwareSchema, DifficultySchema, GameModeSchema } from "./dto.js";

/**
 * Control Plane ⇄ Agent protocol (`/ws/agent`). Kept separate from
 * `events.ts` (browser-facing) because the trust boundary and auth model
 * are entirely different — see docs/architecture.md §2 and §4.
 */

export const AGENT_PROTOCOL_VERSION = 1;

// ---------------------------------------------------------- Handshake --

/**
 * First frame an Agent sends after opening the `/ws/agent` connection.
 * `signature` = Ed25519 sign(nodeId + "." + timestamp + "." + nonce) with the
 * node's private key; Control Plane verifies against the stored public key
 * for `nodeId`, rejects timestamps outside a 60s window, and rejects
 * `nonce` values already seen (replay cache, TTL = window).
 */
export const AgentHandshakeSchema = z.object({
  nodeId: z.string(),
  timestamp: z.number().int(),
  nonce: z.string().min(16).max(64),
  signature: z.string(),
  agentVersion: z.string(),
  protocolVersion: z.number().int(),
});
export type AgentHandshake = z.infer<typeof AgentHandshakeSchema>;

export const EnrollExchangeRequestSchema = z.object({
  enrollmentToken: z.string(),
  publicKey: z.string(), // base64 Ed25519 public key, generated locally by the agent
  hostname: z.string(),
  os: z.string(),
  kernel: z.string(),
  arch: z.enum(["amd64", "arm64"]),
  cpuModel: z.string(),
  cpuCores: z.number().int(),
  memoryTotalMb: z.number().int(),
  diskTotalMb: z.number().int(),
  ipAddress: z.string(),
  javaInstallations: z.array(z.object({ version: z.string(), path: z.string(), vendor: z.string().optional() })),
  agentVersion: z.string(),
  protocolVersion: z.number().int(),
});
export type EnrollExchangeRequest = z.infer<typeof EnrollExchangeRequestSchema>;

export const EnrollExchangeResponseSchema = z.object({
  nodeId: z.string(),
  nodeName: z.string(),
});

// ----------------------------------------------------------- Heartbeat --

export const AgentHeartbeatSchema = z.object({
  nodeId: z.string(),
  agentVersion: z.string(),
  timestamp: z.string(),
  cpuUsagePercent: z.number(),
  memoryUsedMb: z.number(),
  memoryTotalMb: z.number(),
  diskUsedMb: z.number(),
  diskTotalMb: z.number(),
  loadAverage1m: z.number(),
  networkInMbps: z.number(),
  networkOutMbps: z.number(),
  javaInstallations: z.array(z.object({ version: z.string(), path: z.string(), vendor: z.string().optional() })),
  runningServerIds: z.array(z.string()),
});
export type AgentHeartbeat = z.infer<typeof AgentHeartbeatSchema>;

// -------------------------------------------------------------- Commands --

const CommandEnvelope = <T extends z.ZodTypeAny>(type: string, payload: T) =>
  z.object({
    commandId: z.string(),
    type: z.literal(type),
    issuedAt: z.string(),
    payload,
  });

export const ServerInstallCommandSchema = CommandEnvelope(
  "server.install",
  z.object({
    serverId: z.string(),
    software: MinecraftSoftwareSchema,
    minecraftVersion: z.string(),
    build: z.string().optional(),
    javaSelector: z.string(), // e.g. "17", "21" — resolved by the agent's JavaResolver
    memoryMinMb: z.number().int(),
    memoryMaxMb: z.number().int(),
    cpuLimitPercent: z.number().int(),
    diskLimitMb: z.number().int(),
    port: z.number().int(),
    maxPlayers: z.number().int(),
    gameMode: GameModeSchema,
    difficulty: DifficultySchema,
    onlineMode: z.boolean(),
    whitelist: z.boolean(),
    pvp: z.boolean(),
    commandBlocks: z.boolean(),
    motd: z.string().optional(),
    serverIconBase64: z.string().optional(),
    eulaAccepted: z.literal(true),
    autoStart: z.boolean(),
  })
);
export type ServerInstallCommand = z.infer<typeof ServerInstallCommandSchema>;

export const ServerStartCommandSchema = CommandEnvelope("server.start", z.object({ serverId: z.string() }));
export const ServerStopCommandSchema = CommandEnvelope(
  "server.stop",
  z.object({ serverId: z.string(), gracePeriodSeconds: z.number().int().min(0).max(600) })
);
export const ServerRestartCommandSchema = CommandEnvelope(
  "server.restart",
  z.object({ serverId: z.string(), gracePeriodSeconds: z.number().int().min(0).max(600) })
);
export const ServerKillCommandSchema = CommandEnvelope("server.kill", z.object({ serverId: z.string() }));
export const ServerDeleteCommandSchema = CommandEnvelope(
  "server.delete",
  z.object({ serverId: z.string(), deleteFiles: z.boolean() })
);
export const ConsoleCommandSchema = CommandEnvelope(
  "console.command",
  z.object({ serverId: z.string(), command: z.string().max(2000) })
);

export const FileListCommandSchema = CommandEnvelope("file.list", z.object({ serverId: z.string(), path: z.string() }));
export const FileReadCommandSchema = CommandEnvelope("file.read", z.object({ serverId: z.string(), path: z.string() }));
export const FileWriteCommandSchema = CommandEnvelope(
  "file.write",
  z.object({ serverId: z.string(), path: z.string(), contentBase64: z.string() })
);
export const FileDeleteCommandSchema = CommandEnvelope("file.delete", z.object({ serverId: z.string(), path: z.string() }));
export const FileRenameCommandSchema = CommandEnvelope(
  "file.rename",
  z.object({ serverId: z.string(), path: z.string(), newPath: z.string() })
);
export const FileMkdirCommandSchema = CommandEnvelope("file.mkdir", z.object({ serverId: z.string(), path: z.string() }));

export const BackupCreateCommandSchema = CommandEnvelope(
  "backup.create",
  z.object({
    serverId: z.string(),
    backupId: z.string(),
    includesWorlds: z.boolean(),
    includesPlugins: z.boolean(),
    includesConfig: z.boolean(),
    compression: z.enum(["none", "fast", "best"]),
  })
);
export const BackupRestoreCommandSchema = CommandEnvelope(
  "backup.restore",
  z.object({ serverId: z.string(), backupId: z.string(), operationId: z.string(), expectedSha256: z.string().optional() })
);
export const BackupDeleteCommandSchema = CommandEnvelope(
  "backup.delete",
  z.object({ serverId: z.string(), backupId: z.string() })
);

export const PluginInstallCommandSchema = CommandEnvelope(
  "plugin.install",
  z.object({
    serverId: z.string(),
    operationId: z.string(),
    downloadUrl: z.string().url(),
    // Modrinth (the only provider today) publishes sha512 + sha1, not
    // sha256 — see docs/architecture.md. Verified by the Agent before the
    // file is moved into the plugins directory.
    expectedSha512: z.string().optional(),
    targetFileName: z.string(),
  })
);
export const PluginDeleteCommandSchema = CommandEnvelope(
  "plugin.delete",
  z.object({ serverId: z.string(), fileName: z.string() })
);

export const ServerConfigureCommandSchema = CommandEnvelope("server.configure", ServerInstallCommandSchema.shape.payload.omit({ eulaAccepted: true, autoStart: true }));

export const SoftwareVersionsCommandSchema = CommandEnvelope("software.versions", z.object({ software: z.enum(["paper", "purpur", "vanilla", "velocity"]) }));

export const AgentCommandSchema = z.discriminatedUnion("type", [
  SoftwareVersionsCommandSchema,
  ServerInstallCommandSchema,
  ServerConfigureCommandSchema,
  ServerStartCommandSchema,
  ServerStopCommandSchema,
  ServerRestartCommandSchema,
  ServerKillCommandSchema,
  ServerDeleteCommandSchema,
  ConsoleCommandSchema,
  FileListCommandSchema,
  FileReadCommandSchema,
  FileWriteCommandSchema,
  FileDeleteCommandSchema,
  FileRenameCommandSchema,
  FileMkdirCommandSchema,
  BackupCreateCommandSchema,
  BackupRestoreCommandSchema,
  BackupDeleteCommandSchema,
  PluginInstallCommandSchema,
  PluginDeleteCommandSchema,
]);
export type AgentCommand = z.infer<typeof AgentCommandSchema>;

// ------------------------------------------------------------- Acks/events --

export const AgentAckSchema = z.object({
  commandId: z.string(),
  ok: z.boolean(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  result: z.unknown().optional(),
});
export type AgentAck = z.infer<typeof AgentAckSchema>;

/** Agent → Control Plane out-of-band events (not replies to a specific command). */
export const AgentEventSchema = z.object({
  nodeId: z.string(),
  seq: z.number().int(),
  type: z.string(),
  timestamp: z.string(),
  payload: z.unknown(),
});
export type AgentEventFrame = z.infer<typeof AgentEventSchema>;

// --------------------------------------------------------- Frame envelopes --

/** Every frame the Agent sends after the handshake is one of these, tagged by `kind`. */
export const AgentInboundFrameSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ack") }).merge(AgentAckSchema),
  z.object({ kind: z.literal("event") }).merge(AgentEventSchema),
  z.object({ kind: z.literal("heartbeat") }).merge(AgentHeartbeatSchema),
]);
export type AgentInboundFrame = z.infer<typeof AgentInboundFrameSchema>;

/** Every frame the Control Plane sends to an Agent after the handshake. */
export const ControlPlaneFrameSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("handshake_ack"), nodeId: z.string() }),
  z.object({ kind: z.literal("handshake_error"), errorCode: z.string(), errorMessage: z.string() }),
  z.object({ kind: z.literal("command"), command: AgentCommandSchema }),
]);
export type ControlPlaneFrame = z.infer<typeof ControlPlaneFrameSchema>;

