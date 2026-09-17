import { z } from "zod";

/**
 * Wire-format DTOs shared between the Control Plane, the Agent protocol and
 * the web frontend. Field names intentionally mirror `src/types/*.ts` in the
 * existing frontend (see docs/architecture.md §"data flow") so the frontend
 * service layer mostly just fetches + validates instead of reshaping.
 */

// ---------------------------------------------------------------- Server --

export const ServerStatusSchema = z.enum([
  "installing",
  "offline",
  "starting",
  "online",
  "stopping",
  "restarting",
  "crashed",
  "error",
  "suspended",
]);
export type ServerStatusDto = z.infer<typeof ServerStatusSchema>;

export const MinecraftSoftwareSchema = z.enum([
  "paper",
  "purpur",
  "vanilla",
  "fabric",
  "forge",
  "neoforge",
  "velocity",
]);
export type MinecraftSoftwareDto = z.infer<typeof MinecraftSoftwareSchema>;

export const GameModeSchema = z.enum(["survival", "creative", "adventure", "spectator"]);
export const DifficultySchema = z.enum(["peaceful", "easy", "normal", "hard"]);

export const ServerDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon: z.string(),
  status: ServerStatusSchema,
  software: MinecraftSoftwareSchema,
  minecraftVersion: z.string(),
  build: z.string().optional(),
  javaVersion: z.string(),
  nodeId: z.string(),
  networkId: z.string().optional(),
  address: z.object({ host: z.string(), port: z.number().int(), domain: z.string().optional() }),
  players: z.object({ online: z.number().int(), max: z.number().int() }),
  resources: z.object({
    cpuPercent: z.number(),
    cpuLimitPercent: z.number(),
    memoryUsedMb: z.number(),
    memoryMaxMb: z.number(),
    diskUsedMb: z.number(),
    diskMaxMb: z.number(),
  }),
  performance: z.object({ tps: z.number(), mspt: z.number() }),
  uptimeSeconds: z.number(),
  createdAt: z.string(),
  lastStartedAt: z.string().optional(),
  world: z.string(),
  difficulty: DifficultySchema,
  gameMode: GameModeSchema,
  onlineMode: z.boolean(),
  whitelist: z.boolean(),
  pvp: z.boolean(),
  commandBlocks: z.boolean(),
  motd: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type ServerDto = z.infer<typeof ServerDtoSchema>;

export const CreateServerInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Server name must be at least 3 characters.")
    .max(64, "Server name must be at most 64 characters.")
    .regex(/^[a-zA-Z0-9 _.-]+$/, "Server name may only contain letters, numbers, spaces, dots, dashes and underscores."),
  description: z.string().trim().max(280).optional(),
  icon: z.string().min(1).max(64),
  software: MinecraftSoftwareSchema,
  minecraftVersion: z.string().min(1).max(32),
  build: z.string().max(64).optional(),
  nodeId: z.string(),
  memoryMinMb: z.number().int().min(256).max(1024 * 1024),
  memoryMaxMb: z.number().int().min(256).max(1024 * 1024),
  cpuLimitPercent: z.number().int().min(10).max(100 * 64),
  diskLimitMb: z.number().int().min(256).max(1024 * 1024 * 4),
  port: z.number().int().min(1024).max(65535),
  maxPlayers: z.number().int().min(1).max(2000),
  gameMode: GameModeSchema,
  difficulty: DifficultySchema,
  onlineMode: z.boolean(),
  whitelist: z.boolean(),
  pvp: z.boolean(),
  commandBlocks: z.boolean(),
  // A raw newline separates the two lines the Minecraft server-list UI
  // actually renders; §-prefixed color/format codes are validated for
  // shape here but their exact meaning is Minecraft's, not ours.
  motd: z
    .string()
    .trim()
    .max(200, "MOTD must be at most 200 characters.")
    .refine((v) => !/\r/.test(v), "MOTD must not contain carriage returns.")
    .refine((v) => v.split("\n").length <= 2, "MOTD supports at most 2 lines.")
    .optional(),
  // The multiplayer server-list icon (server-icon.png) — resized to
  // exactly 64x64 client-side before it's ever sent here. Re-checked
  // server-side (PNG magic bytes), since a client is exactly the kind of
  // boundary this repo's own conventions say not to trust blindly.
  serverIconBase64: z
    .string()
    .max(300_000, "Server icon is too large.")
    .refine((v) => {
      const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      try {
        return Buffer.from(v, "base64").subarray(0, 8).equals(PNG_SIGNATURE);
      } catch {
        return false;
      }
    }, "Server icon must be a valid PNG image.")
    .optional(),
  eulaAccepted: z.literal(true, { message: "You must accept the Minecraft EULA to create a server." }),
});
export type CreateServerInput = z.infer<typeof CreateServerInputSchema>;

// ------------------------------------------------------------------ Node --

export const NodeStatusSchema = z.enum(["healthy", "degraded", "offline"]);

export const NodeDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
  status: NodeStatusSchema,
  ipAddress: z.string(),
  os: z.string(),
  kernel: z.string(),
  arch: z.string(),
  cpu: z.object({ model: z.string(), cores: z.number().int(), usagePercent: z.number() }),
  memory: z.object({ usedGb: z.number(), totalGb: z.number() }),
  disk: z.object({ usedGb: z.number(), totalGb: z.number() }),
  network: z.object({ inMbps: z.number(), outMbps: z.number() }),
  javaVersions: z.array(z.string()),
  agentVersion: z.string(),
  lastHeartbeat: z.string(),
  serverCount: z.number().int(),
  isLocal: z.boolean(),
});
export type NodeDto = z.infer<typeof NodeDtoSchema>;

export const CreateEnrollmentTokenInputSchema = z.object({
  label: z.string().trim().min(1).max(64),
});

export const EnrollmentTokenDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  token: z.string().optional(), // present only in the create-response, never again
  createdAt: z.string(),
  expiresAt: z.string(),
  usedAt: z.string().optional(),
});
export type EnrollmentTokenDto = z.infer<typeof EnrollmentTokenDtoSchema>;

// ------------------------------------------------------------------ User --

export const RoleNameSchema = z.enum(["owner", "administrator", "developer", "moderator", "viewer"]);
export const UserStatusSchema = z.enum(["active", "invited", "suspended"]);

export const PlatformUserDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  avatarSeed: z.string(),
  role: RoleNameSchema,
  serverIds: z.array(z.string()),
  lastActive: z.string(),
  status: UserStatusSchema,
  createdAt: z.string(),
});
export type PlatformUserDto = z.infer<typeof PlatformUserDtoSchema>;

export const SessionUserDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  avatarSeed: z.string(),
  role: RoleNameSchema,
  isSuperAdmin: z.boolean(),
  permissions: z.array(z.string()),
  serverIds: z.array(z.string()).nullable(), // null = access to all servers
  totpEnabled: z.boolean(),
});
export type SessionUserDto = z.infer<typeof SessionUserDtoSchema>;

// --------------------------------------------------------------- Player --

export const PlayerPositionSchema = z.object({ x: z.number(), y: z.number(), z: z.number(), world: z.string() });

export const InventoryItemSchema = z.object({
  slot: z.number().int(),
  itemId: z.string(),
  name: z.string(),
  count: z.number().int(),
  iconUrl: z.string().optional(),
  enchanted: z.boolean().optional(),
});

export const PlayerAchievementDtoSchema = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string(),
  serverId: z.string(),
  earnedAt: z.string(),
});
export type PlayerAchievementDto = z.infer<typeof PlayerAchievementDtoSchema>;

export const PlayerDtoSchema = z.object({
  id: z.string(),
  uuid: z.string(),
  username: z.string(),
  avatarSeed: z.string(),
  online: z.boolean(),
  serverId: z.string().optional(),
  position: PlayerPositionSchema.optional(),
  gameMode: GameModeSchema,
  ping: z.number().int().optional(),
  playtimeSeconds: z.number(),
  firstJoined: z.string(),
  lastSeen: z.string(),
  banned: z.boolean(),
  banReason: z.string().optional(),
  bannedBy: z.string().optional(),
  whitelisted: z.boolean(),
  operator: z.boolean(),
  inventory: z
    .object({
      helmet: InventoryItemSchema.optional(),
      chestplate: InventoryItemSchema.optional(),
      leggings: InventoryItemSchema.optional(),
      boots: InventoryItemSchema.optional(),
      offhand: InventoryItemSchema.optional(),
      hotbar: z.array(InventoryItemSchema.optional()),
      main: z.array(InventoryItemSchema.optional()),
    })
    .optional(),
  achievements: z.array(PlayerAchievementDtoSchema),
});
export type PlayerDto = z.infer<typeof PlayerDtoSchema>;

const MC_USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
export const MinecraftUsernameSchema = z.string().regex(MC_USERNAME_RE, "Invalid Minecraft username.");
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export const MinecraftUuidSchema = z.string().regex(UUID_RE, "Invalid UUID.");

// --------------------------------------------------------------- Plugin --

export const PluginStatusSchema = z.enum(["enabled", "disabled", "error"]);
export const PluginCategorySchema = z.enum([
  "administration",
  "world-management",
  "economy",
  "permissions",
  "performance",
  "chat",
  "protection",
  "utility",
]);

export const InstalledPluginDtoSchema = z.object({
  id: z.string(),
  serverId: z.string(),
  name: z.string(),
  version: z.string(),
  latestVersion: z.string().optional(),
  author: z.string(),
  description: z.string(),
  status: PluginStatusSchema,
  category: PluginCategorySchema,
  updateAvailable: z.boolean(),
  iconLetter: z.string(),
  fileSizeMb: z.number(),
  installedAt: z.string(),
  providerSlug: z.string().optional(),
  providerProjectId: z.string().optional(),
});
export type InstalledPluginDto = z.infer<typeof InstalledPluginDtoSchema>;

// --------------------------------------------------------------- World --

export const WorldEnvironmentSchema = z.enum(["overworld", "nether", "the_end"]);

export const WorldDtoSchema = z.object({
  id: z.string(),
  serverId: z.string(),
  name: z.string(),
  environment: WorldEnvironmentSchema,
  sizeMb: z.number(),
  seed: z.string(),
  difficulty: DifficultySchema,
  gameMode: GameModeSchema,
  structures: z.boolean(),
  hardcore: z.boolean(),
  lastBackup: z.string().optional(),
  generator: z.enum(["default", "flat", "large_biomes", "amplified", "single_biome"]),
});
export type WorldDto = z.infer<typeof WorldDtoSchema>;

// -------------------------------------------------------------- Backup --

export const BackupTypeSchema = z.enum(["automatic", "manual"]);
export const BackupStatusSchema = z.enum(["completed", "in_progress", "failed"]);

export const BackupDtoSchema = z.object({
  id: z.string(),
  serverId: z.string(),
  name: z.string(),
  createdAt: z.string(),
  sizeMb: z.number(),
  type: BackupTypeSchema,
  status: BackupStatusSchema,
  location: z.string(),
  includesWorlds: z.boolean(),
  includesPlugins: z.boolean(),
  includesConfig: z.boolean(),
  compression: z.enum(["none", "fast", "best"]),
  checksumSha256: z.string().optional(),
});
export type BackupDto = z.infer<typeof BackupDtoSchema>;

export const CreateBackupInputSchema = z.object({
  name: z.string().trim().min(1).max(96),
  includesWorlds: z.boolean(),
  includesPlugins: z.boolean(),
  includesConfig: z.boolean(),
  compression: z.enum(["none", "fast", "best"]),
});
export type CreateBackupInput = z.infer<typeof CreateBackupInputSchema>;

// ------------------------------------------------------------- Schedule --

export const ScheduleActionSchema = z.enum(["restart", "stop", "start", "backup", "command", "message"]);

export const ScheduleDtoSchema = z.object({
  id: z.string(),
  serverId: z.string(),
  name: z.string(),
  action: ScheduleActionSchema,
  commandPayload: z.string().optional(),
  scheduleDescription: z.string(),
  cronExpression: z.string(),
  timezone: z.string(),
  enabled: z.boolean(),
  nextRun: z.string(),
  lastRun: z.string().optional(),
});
export type ScheduleDto = z.infer<typeof ScheduleDtoSchema>;

const CRON_FIELD = "[\\d*/,-]+";
const CRON_RE = new RegExp(`^${CRON_FIELD}(\\s+${CRON_FIELD}){4}$`);
export const CronExpressionSchema = z.string().regex(CRON_RE, "Invalid cron expression (expected 5 fields).");

export const CreateScheduleInputSchema = z.object({
  name: z.string().trim().min(1).max(96),
  action: ScheduleActionSchema,
  commandPayload: z.string().max(1024).optional(),
  cronExpression: CronExpressionSchema,
  timezone: z.string().min(1).max(64),
  enabled: z.boolean(),
});
export type CreateScheduleInput = z.infer<typeof CreateScheduleInputSchema>;

// ------------------------------------------------------------- Activity --

export const AuditSeveritySchema = z.enum(["info", "success", "warning", "critical"]);

export const AuditEventDtoSchema = z.object({
  id: z.string(),
  actor: z.object({ id: z.string(), name: z.string(), avatarSeed: z.string(), isSystem: z.boolean() }),
  action: z.string(),
  description: z.string(),
  targetType: z.enum(["server", "player", "plugin", "backup", "node", "user", "file", "world", "schedule", "settings"]).optional(),
  targetLabel: z.string().optional(),
  serverId: z.string().optional(),
  severity: AuditSeveritySchema,
  timestamp: z.string(),
});
export type AuditEventDto = z.infer<typeof AuditEventDtoSchema>;

// --------------------------------------------------------- Notification --

export const NotificationTypeSchema = z.enum(["info", "success", "warning", "critical"]);

export const NotificationDtoSchema = z.object({
  id: z.string(),
  type: NotificationTypeSchema,
  title: z.string(),
  message: z.string(),
  timestamp: z.string(),
  read: z.boolean(),
  serverId: z.string().optional(),
});
export type NotificationDto = z.infer<typeof NotificationDtoSchema>;

// ---------------------------------------------------------------- File --

export const FileEntryKindSchema = z.enum([
  "folder", "yaml", "json", "jar", "txt", "log", "zip", "world", "properties", "unknown",
]);

export const FileEntryDtoSchema = z.object({
  id: z.string(),
  serverId: z.string(),
  path: z.string(),
  name: z.string(),
  kind: FileEntryKindSchema,
  sizeBytes: z.number(),
  modifiedAt: z.string(),
  permissions: z.string(),
  editable: z.boolean(),
});
export type FileEntryDto = z.infer<typeof FileEntryDtoSchema>;

/**
 * Every file path accepted from a client is relative, POSIX-style, and
 * must not contain traversal segments. The Agent independently re-validates
 * this against SERVER_ROOT (defense in depth) — this schema only rejects
 * the cheap, obvious cases before the request goes anywhere.
 */
export const RelativeServerPathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine((p) => !p.includes("\0"), "Invalid path.")
  .refine((p) => !p.startsWith("/"), "Path must be relative to the server root.")
  .refine((p) => !p.split("/").includes(".."), "Path traversal is not allowed.");

// ------------------------------------------------------------- Console --

export const LogLevelSchema = z.enum(["INFO", "WARN", "ERROR", "CHAT", "COMMAND"]);

export const ConsoleLineDtoSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  level: LogLevelSchema,
  message: z.string(),
});
export type ConsoleLineDto = z.infer<typeof ConsoleLineDtoSchema>;

// -------------------------------------------------------------- Metric --

export const MetricPointDtoSchema = z.object({
  timestamp: z.string(),
  cpu: z.number(),
  memory: z.number(),
  players: z.number(),
  tps: z.number(),
  mspt: z.number(),
});
export type MetricPointDto = z.infer<typeof MetricPointDtoSchema>;
export const MetricRangeSchema = z.enum(["15m", "1h", "6h", "24h", "7d"]);

// ------------------------------------------------------------- Network --

export const NetworkDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  proxyServerId: z.string(),
  connectedServerIds: z.array(z.string()),
  createdAt: z.string(),
});
export type NetworkDto = z.infer<typeof NetworkDtoSchema>;

// ----------------------------------------------------------- Operation --

export const OperationTypeSchema = z.enum([
  "SERVER_INSTALL",
  "SERVER_START",
  "SERVER_STOP",
  "SERVER_RESTART",
  "SERVER_KILL",
  "SERVER_DELETE",
  "BACKUP_CREATE",
  "BACKUP_RESTORE",
  "PLUGIN_INSTALL",
  "PLUGIN_UPDATE",
  "WORLD_IMPORT",
  "WORLD_RESET",
  "WORLD_DELETE",
]);
export const OperationStatusSchema = z.enum(["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]);

export const OperationDtoSchema = z.object({
  id: z.string(),
  type: OperationTypeSchema,
  resourceId: z.string(),
  status: OperationStatusSchema,
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
  errorCode: z.string().optional(),
  createdAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
});
export type OperationDto = z.infer<typeof OperationDtoSchema>;

// ---------------------------------------------------------------- API key --

export const ApiKeyScopeSchema = z.enum([
  "server:read", "server:write",
  "players:read", "players:write",
  "files:read", "files:write",
  "nodes:read", "nodes:write",
  "backups:read", "backups:write",
]);

export const ApiKeyDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  scopes: z.array(ApiKeyScopeSchema),
  keyPreview: z.string(), // e.g. "mck_live_ab12…" — prefix only
  createdAt: z.string(),
  expiresAt: z.string().optional(),
  lastUsedAt: z.string().optional(),
  revokedAt: z.string().optional(),
});
export type ApiKeyDto = z.infer<typeof ApiKeyDtoSchema>;

export const CreateApiKeyInputSchema = z.object({
  label: z.string().trim().min(1).max(64),
  scopes: z.array(ApiKeyScopeSchema).min(1),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
});
