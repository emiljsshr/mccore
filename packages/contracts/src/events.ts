import { z } from "zod";
import {
  ServerStatusSchema,
  ConsoleLineDtoSchema,
  MetricPointDtoSchema,
  NodeStatusSchema,
  NotificationDtoSchema,
  OperationStatusSchema,
} from "./dto.js";

/**
 * Browser ⇄ Control Plane realtime events (`/ws/live`). Every frame is one
 * `WsEventEnvelope`; `payload` is validated against the schema for `type`
 * before being sent or accepted (§29).
 */

export const WsEventEnvelopeSchema = z.object({
  type: z.string(),
  version: z.literal(1),
  timestamp: z.string(),
  resourceId: z.string(),
  payload: z.unknown(),
});
export type WsEventEnvelope = z.infer<typeof WsEventEnvelopeSchema>;

export const NodeStatusEventSchema = z.object({ status: NodeStatusSchema });
export const NodeMetricsEventSchema = z.object({
  cpuUsagePercent: z.number(),
  memoryUsedGb: z.number(),
  memoryTotalGb: z.number(),
  diskUsedGb: z.number(),
  diskTotalGb: z.number(),
  networkInMbps: z.number(),
  networkOutMbps: z.number(),
});

export const ServerStatusEventSchema = z.object({ status: ServerStatusSchema, message: z.string().optional() });
export const ServerMetricsEventSchema = MetricPointDtoSchema;
export const ServerConsoleEventSchema = z.object({ lines: z.array(ConsoleLineDtoSchema) });
export const ServerInstallProgressEventSchema = z.object({
  operationId: z.string(),
  stage: z.enum(["PREPARING", "DOWNLOADING", "VERIFYING", "CONFIGURING", "READY", "STARTING", "ONLINE", "FAILED"]),
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
});

export const PlayerJoinEventSchema = z.object({ uuid: z.string(), username: z.string() });
export const PlayerLeaveEventSchema = z.object({ uuid: z.string(), username: z.string() });
export const PlayerAchievementEventSchema = z.object({
  uuid: z.string(),
  username: z.string(),
  key: z.string(),
  title: z.string(),
  description: z.string(),
});
export const PlayerDeathEventSchema = z.object({
  uuid: z.string(),
  username: z.string(),
  message: z.string(),
  killer: z.string().optional(),
});
export const ChatMessageEventSchema = z.object({ uuid: z.string(), username: z.string(), message: z.string() });

export const BackupProgressEventSchema = z.object({
  backupId: z.string(),
  stage: z.enum(["PREPARING", "SAVING", "COMPRESSING", "HASHING", "COMPLETED", "FAILED"]),
  progress: z.number().min(0).max(100),
});

export const PluginInstallProgressEventSchema = z.object({
  operationId: z.string(),
  stage: z.enum(["RESOLVING", "DOWNLOADING", "VERIFYING", "INSTALLING", "COMPLETED", "FAILED"]),
  progress: z.number().min(0).max(100),
});

export const OperationUpdatedEventSchema = z.object({
  operationId: z.string(),
  status: OperationStatusSchema,
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
});

export const NotificationCreatedEventSchema = NotificationDtoSchema;

export const WS_EVENT_SCHEMAS = {
  "node.status": NodeStatusEventSchema,
  "node.metrics": NodeMetricsEventSchema,
  "server.status": ServerStatusEventSchema,
  "server.metrics": ServerMetricsEventSchema,
  "server.console": ServerConsoleEventSchema,
  "server.install.progress": ServerInstallProgressEventSchema,
  "player.join": PlayerJoinEventSchema,
  "player.leave": PlayerLeaveEventSchema,
  "player.achievement": PlayerAchievementEventSchema,
  "player.death": PlayerDeathEventSchema,
  "chat.message": ChatMessageEventSchema,
  "backup.progress": BackupProgressEventSchema,
  "plugin.install.progress": PluginInstallProgressEventSchema,
  "operation.updated": OperationUpdatedEventSchema,
  "notification.created": NotificationCreatedEventSchema,
} as const;

export type WsEventType = keyof typeof WS_EVENT_SCHEMAS;

export function parseWsEventPayload<T extends WsEventType>(type: T, payload: unknown) {
  return WS_EVENT_SCHEMAS[type].parse(payload);
}

/** Client → server subscribe/unsubscribe control frames on `/ws/live`. */
export const WsClientMessageSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("subscribe"), channel: z.string() }),
  z.object({ op: z.literal("unsubscribe"), channel: z.string() }),
  z.object({ op: z.literal("ping") }),
]);
export type WsClientMessage = z.infer<typeof WsClientMessageSchema>;
