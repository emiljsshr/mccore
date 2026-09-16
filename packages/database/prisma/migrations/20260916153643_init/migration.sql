-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "NodeStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'OFFLINE');

-- CreateEnum
CREATE TYPE "ServerStatus" AS ENUM ('INSTALLING', 'OFFLINE', 'STARTING', 'ONLINE', 'STOPPING', 'RESTARTING', 'CRASHED', 'ERROR', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MinecraftSoftware" AS ENUM ('PAPER', 'PURPUR', 'VANILLA', 'FABRIC', 'FORGE', 'NEOFORGE', 'VELOCITY');

-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('SURVIVAL', 'CREATIVE', 'ADVENTURE', 'SPECTATOR');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('PEACEFUL', 'EASY', 'NORMAL', 'HARD');

-- CreateEnum
CREATE TYPE "PluginStatus" AS ENUM ('ENABLED', 'DISABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "BackupType" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('COMPLETED', 'IN_PROGRESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ScheduleExecutionStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "OperationStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" VARCHAR(26) NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatarSeed" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" VARCHAR(26) NOT NULL,
    "userId" VARCHAR(26) NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwoFactorCredential" (
    "id" VARCHAR(26) NOT NULL,
    "userId" VARCHAR(26) NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "TwoFactorCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryCode" (
    "id" VARCHAR(26) NOT NULL,
    "userId" VARCHAR(26) NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" VARCHAR(26) NOT NULL,
    "userId" VARCHAR(26) NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BootstrapToken" (
    "id" VARCHAR(26) NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BootstrapToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" VARCHAR(26) NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isGlobalAccess" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "group" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" VARCHAR(26) NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" VARCHAR(26) NOT NULL,
    "roleId" VARCHAR(26) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "UserServerAccess" (
    "id" VARCHAR(26) NOT NULL,
    "userId" VARCHAR(26) NOT NULL,
    "serverId" VARCHAR(26) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserServerAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Node" (
    "id" VARCHAR(26) NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "status" "NodeStatus" NOT NULL DEFAULT 'OFFLINE',
    "isLocal" BOOLEAN NOT NULL DEFAULT false,
    "hostname" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "os" TEXT NOT NULL,
    "kernel" TEXT NOT NULL,
    "arch" TEXT NOT NULL,
    "cpuModel" TEXT NOT NULL,
    "cpuCores" INTEGER NOT NULL,
    "memoryTotalMb" INTEGER NOT NULL,
    "diskTotalMb" INTEGER NOT NULL,
    "agentVersion" TEXT NOT NULL,
    "protocolVersion" INTEGER NOT NULL,
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastSeq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeCredential" (
    "id" VARCHAR(26) NOT NULL,
    "nodeId" VARCHAR(26) NOT NULL,
    "publicKey" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'ed25519',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "NodeCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentNonce" (
    "id" VARCHAR(26) NOT NULL,
    "nodeId" VARCHAR(26) NOT NULL,
    "nonce" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentNonce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeMetric" (
    "id" VARCHAR(26) NOT NULL,
    "nodeId" VARCHAR(26) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpuUsagePercent" DOUBLE PRECISION NOT NULL,
    "memoryUsedMb" INTEGER NOT NULL,
    "diskUsedMb" INTEGER NOT NULL,
    "loadAverage1m" DOUBLE PRECISION NOT NULL,
    "networkInMbps" DOUBLE PRECISION NOT NULL,
    "networkOutMbps" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "NodeMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentToken" (
    "id" VARCHAR(26) NOT NULL,
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdByUserId" VARCHAR(26) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "nodeId" VARCHAR(26),

    CONSTRAINT "EnrollmentToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinecraftServer" (
    "id" VARCHAR(26) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT NOT NULL DEFAULT 'Server',
    "status" "ServerStatus" NOT NULL DEFAULT 'INSTALLING',
    "software" "MinecraftSoftware" NOT NULL,
    "minecraftVersion" TEXT NOT NULL,
    "build" TEXT,
    "javaVersion" TEXT NOT NULL,
    "nodeId" VARCHAR(26) NOT NULL,
    "networkId" VARCHAR(26),
    "host" TEXT NOT NULL DEFAULT '0.0.0.0',
    "port" INTEGER NOT NULL,
    "onlinePlayers" INTEGER NOT NULL DEFAULT 0,
    "maxPlayers" INTEGER NOT NULL DEFAULT 20,
    "memoryMinMb" INTEGER NOT NULL,
    "memoryMaxMb" INTEGER NOT NULL,
    "cpuLimitPercent" INTEGER NOT NULL,
    "diskLimitMb" INTEGER NOT NULL,
    "world" TEXT NOT NULL DEFAULT 'world',
    "difficulty" "Difficulty" NOT NULL DEFAULT 'NORMAL',
    "gameMode" "GameMode" NOT NULL DEFAULT 'SURVIVAL',
    "onlineMode" BOOLEAN NOT NULL DEFAULT true,
    "whitelist" BOOLEAN NOT NULL DEFAULT false,
    "pvp" BOOLEAN NOT NULL DEFAULT true,
    "commandBlocks" BOOLEAN NOT NULL DEFAULT false,
    "serverDirectory" TEXT NOT NULL,
    "jarFile" TEXT NOT NULL DEFAULT 'server.jar',
    "autoStart" BOOLEAN NOT NULL DEFAULT false,
    "autoRestart" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "currentPid" INTEGER,
    "lastTps" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "lastMspt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpuPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "memoryUsedMb" INTEGER NOT NULL DEFAULT 0,
    "diskUsedMb" INTEGER NOT NULL DEFAULT 0,
    "lockedOperationId" VARCHAR(26),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastStartedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MinecraftServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerAllocation" (
    "id" VARCHAR(26) NOT NULL,
    "nodeId" VARCHAR(26) NOT NULL,
    "ip" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'TCP',
    "serverId" VARCHAR(26),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerEnvironment" (
    "id" VARCHAR(26) NOT NULL,
    "serverId" VARCHAR(26) NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ServerEnvironment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Network" (
    "id" VARCHAR(26) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "proxyServerId" VARCHAR(26) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Network_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EulaAcceptance" (
    "id" VARCHAR(26) NOT NULL,
    "userId" VARCHAR(26) NOT NULL,
    "serverId" VARCHAR(26) NOT NULL,
    "eulaVersion" TEXT NOT NULL DEFAULT '2024-01',
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EulaAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" VARCHAR(26) NOT NULL,
    "uuid" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarSeed" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playtimeSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSession" (
    "id" VARCHAR(26) NOT NULL,
    "playerId" VARCHAR(26) NOT NULL,
    "serverId" VARCHAR(26) NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,

    CONSTRAINT "PlayerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerBan" (
    "id" VARCHAR(26) NOT NULL,
    "serverId" VARCHAR(26) NOT NULL,
    "playerId" VARCHAR(26) NOT NULL,
    "reason" TEXT,
    "bannedByUserId" VARCHAR(26),
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "pardonedAt" TIMESTAMP(3),
    "pardonedByUserId" VARCHAR(26),

    CONSTRAINT "PlayerBan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhitelistEntry" (
    "id" VARCHAR(26) NOT NULL,
    "serverId" VARCHAR(26) NOT NULL,
    "playerId" VARCHAR(26) NOT NULL,
    "addedByUserId" VARCHAR(26),
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhitelistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorEntry" (
    "id" VARCHAR(26) NOT NULL,
    "serverId" VARCHAR(26) NOT NULL,
    "playerId" VARCHAR(26) NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 4,
    "addedByUserId" VARCHAR(26),
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperatorEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plugin" (
    "id" VARCHAR(26) NOT NULL,
    "providerSlug" TEXT NOT NULL,
    "providerProjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supportedVersions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "iconUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plugin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstalledPlugin" (
    "id" VARCHAR(26) NOT NULL,
    "serverId" VARCHAR(26) NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "latestVersion" TEXT,
    "author" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "PluginStatus" NOT NULL DEFAULT 'ENABLED',
    "category" TEXT NOT NULL,
    "fileSizeMb" DOUBLE PRECISION NOT NULL,
    "fileName" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerSlug" TEXT,
    "providerProjectId" TEXT,
    "checksumSha256" TEXT,

    CONSTRAINT "InstalledPlugin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "World" (
    "id" VARCHAR(26) NOT NULL,
    "serverId" VARCHAR(26) NOT NULL,
    "name" TEXT NOT NULL,
    "directoryName" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'overworld',
    "sizeMb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "seed" TEXT NOT NULL DEFAULT '',
    "difficulty" "Difficulty" NOT NULL DEFAULT 'NORMAL',
    "gameMode" "GameMode" NOT NULL DEFAULT 'SURVIVAL',
    "structures" BOOLEAN NOT NULL DEFAULT true,
    "hardcore" BOOLEAN NOT NULL DEFAULT false,
    "lastBackupAt" TIMESTAMP(3),
    "generator" TEXT NOT NULL DEFAULT 'default',

    CONSTRAINT "World_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Backup" (
    "id" VARCHAR(26) NOT NULL,
    "serverId" VARCHAR(26) NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sizeMb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "type" "BackupType" NOT NULL,
    "status" "BackupStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "storageProvider" TEXT NOT NULL DEFAULT 'local',
    "storagePath" TEXT NOT NULL,
    "includesWorlds" BOOLEAN NOT NULL DEFAULT true,
    "includesPlugins" BOOLEAN NOT NULL DEFAULT true,
    "includesConfig" BOOLEAN NOT NULL DEFAULT true,
    "compression" TEXT NOT NULL DEFAULT 'fast',
    "checksumSha256" TEXT,
    "errorMessage" TEXT,
    "createdByUserId" VARCHAR(26),

    CONSTRAINT "Backup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" VARCHAR(26) NOT NULL,
    "serverId" VARCHAR(26) NOT NULL,
    "name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "commandPayload" TEXT,
    "cronExpression" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdByUserId" VARCHAR(26),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleExecution" (
    "id" VARCHAR(26) NOT NULL,
    "scheduleId" VARCHAR(26) NOT NULL,
    "status" "ScheduleExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "message" TEXT,

    CONSTRAINT "ScheduleExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" VARCHAR(26) NOT NULL,
    "actorUserId" VARCHAR(26),
    "actorIsSystem" BOOLEAN NOT NULL DEFAULT false,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "targetType" TEXT,
    "targetLabel" TEXT,
    "serverId" VARCHAR(26),
    "resourceId" TEXT,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
    "ipAddress" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" VARCHAR(26) NOT NULL,
    "userId" VARCHAR(26),
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "serverId" VARCHAR(26),
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" VARCHAR(26) NOT NULL,
    "userId" VARCHAR(26) NOT NULL,
    "label" TEXT NOT NULL,
    "scopes" TEXT[],
    "keyHash" TEXT NOT NULL,
    "keyPreview" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" VARCHAR(26),

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ServerMetric" (
    "id" VARCHAR(26) NOT NULL,
    "serverId" VARCHAR(26) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpuPercent" DOUBLE PRECISION NOT NULL,
    "memoryUsedMb" INTEGER NOT NULL,
    "tps" DOUBLE PRECISION NOT NULL,
    "mspt" DOUBLE PRECISION NOT NULL,
    "playersOnline" INTEGER NOT NULL,

    CONSTRAINT "ServerMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentEvent" (
    "id" VARCHAR(26) NOT NULL,
    "nodeId" VARCHAR(26) NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAuditEvent" (
    "id" VARCHAR(26) NOT NULL,
    "serverId" VARCHAR(26) NOT NULL,
    "userId" VARCHAR(26),
    "action" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" VARCHAR(26) NOT NULL,
    "type" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "status" "OperationStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "errorCode" TEXT,
    "idempotencyKey" TEXT,
    "createdByUserId" VARCHAR(26),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "key" TEXT NOT NULL,
    "userId" VARCHAR(26) NOT NULL,
    "endpoint" TEXT NOT NULL,
    "responseStatus" INTEGER,
    "responseSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TwoFactorCredential_userId_key" ON "TwoFactorCredential"("userId");

-- CreateIndex
CREATE INDEX "RecoveryCode_userId_idx" ON "RecoveryCode"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BootstrapToken_codeHash_key" ON "BootstrapToken"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserServerAccess_userId_serverId_key" ON "UserServerAccess"("userId", "serverId");

-- CreateIndex
CREATE INDEX "Node_status_idx" ON "Node"("status");

-- CreateIndex
CREATE INDEX "NodeCredential_nodeId_isActive_idx" ON "NodeCredential"("nodeId", "isActive");

-- CreateIndex
CREATE INDEX "AgentNonce_seenAt_idx" ON "AgentNonce"("seenAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentNonce_nodeId_nonce_key" ON "AgentNonce"("nodeId", "nonce");

-- CreateIndex
CREATE INDEX "NodeMetric_nodeId_timestamp_idx" ON "NodeMetric"("nodeId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentToken_tokenHash_key" ON "EnrollmentToken"("tokenHash");

-- CreateIndex
CREATE INDEX "MinecraftServer_nodeId_idx" ON "MinecraftServer"("nodeId");

-- CreateIndex
CREATE INDEX "MinecraftServer_status_idx" ON "MinecraftServer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ServerAllocation_nodeId_ip_port_protocol_key" ON "ServerAllocation"("nodeId", "ip", "port", "protocol");

-- CreateIndex
CREATE UNIQUE INDEX "ServerEnvironment_serverId_key_key" ON "ServerEnvironment"("serverId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Network_proxyServerId_key" ON "Network"("proxyServerId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_uuid_key" ON "Player"("uuid");

-- CreateIndex
CREATE INDEX "Player_username_idx" ON "Player"("username");

-- CreateIndex
CREATE INDEX "PlayerSession_serverId_leftAt_idx" ON "PlayerSession"("serverId", "leftAt");

-- CreateIndex
CREATE INDEX "PlayerSession_playerId_idx" ON "PlayerSession"("playerId");

-- CreateIndex
CREATE INDEX "PlayerBan_serverId_playerId_idx" ON "PlayerBan"("serverId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "WhitelistEntry_serverId_playerId_key" ON "WhitelistEntry"("serverId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "OperatorEntry_serverId_playerId_key" ON "OperatorEntry"("serverId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Plugin_providerSlug_providerProjectId_key" ON "Plugin"("providerSlug", "providerProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "InstalledPlugin_serverId_fileName_key" ON "InstalledPlugin"("serverId", "fileName");

-- CreateIndex
CREATE UNIQUE INDEX "World_serverId_directoryName_key" ON "World"("serverId", "directoryName");

-- CreateIndex
CREATE INDEX "Backup_serverId_createdAt_idx" ON "Backup"("serverId", "createdAt");

-- CreateIndex
CREATE INDEX "Schedule_serverId_idx" ON "Schedule"("serverId");

-- CreateIndex
CREATE INDEX "Schedule_enabled_nextRunAt_idx" ON "Schedule"("enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "ScheduleExecution_scheduleId_status_idx" ON "ScheduleExecution"("scheduleId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_serverId_idx" ON "AuditLog"("serverId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "ServerMetric_serverId_timestamp_idx" ON "ServerMetric"("serverId", "timestamp");

-- CreateIndex
CREATE INDEX "AgentEvent_nodeId_seq_idx" ON "AgentEvent"("nodeId", "seq");

-- CreateIndex
CREATE INDEX "AgentEvent_createdAt_idx" ON "AgentEvent"("createdAt");

-- CreateIndex
CREATE INDEX "FileAuditEvent_serverId_createdAt_idx" ON "FileAuditEvent"("serverId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Operation_idempotencyKey_key" ON "Operation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Operation_resourceId_idx" ON "Operation"("resourceId");

-- CreateIndex
CREATE INDEX "Operation_status_idx" ON "Operation"("status");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoFactorCredential" ADD CONSTRAINT "TwoFactorCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCode" ADD CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserServerAccess" ADD CONSTRAINT "UserServerAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserServerAccess" ADD CONSTRAINT "UserServerAccess_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MinecraftServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeCredential" ADD CONSTRAINT "NodeCredential_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentNonce" ADD CONSTRAINT "AgentNonce_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeMetric" ADD CONSTRAINT "NodeMetric_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentToken" ADD CONSTRAINT "EnrollmentToken_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinecraftServer" ADD CONSTRAINT "MinecraftServer_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinecraftServer" ADD CONSTRAINT "MinecraftServer_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerAllocation" ADD CONSTRAINT "ServerAllocation_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerAllocation" ADD CONSTRAINT "ServerAllocation_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MinecraftServer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerEnvironment" ADD CONSTRAINT "ServerEnvironment_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MinecraftServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Network" ADD CONSTRAINT "Network_proxyServerId_fkey" FOREIGN KEY ("proxyServerId") REFERENCES "MinecraftServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EulaAcceptance" ADD CONSTRAINT "EulaAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EulaAcceptance" ADD CONSTRAINT "EulaAcceptance_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MinecraftServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSession" ADD CONSTRAINT "PlayerSession_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSession" ADD CONSTRAINT "PlayerSession_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MinecraftServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerBan" ADD CONSTRAINT "PlayerBan_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MinecraftServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerBan" ADD CONSTRAINT "PlayerBan_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhitelistEntry" ADD CONSTRAINT "WhitelistEntry_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MinecraftServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhitelistEntry" ADD CONSTRAINT "WhitelistEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorEntry" ADD CONSTRAINT "OperatorEntry_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MinecraftServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorEntry" ADD CONSTRAINT "OperatorEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstalledPlugin" ADD CONSTRAINT "InstalledPlugin_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MinecraftServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "World" ADD CONSTRAINT "World_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MinecraftServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Backup" ADD CONSTRAINT "Backup_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MinecraftServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Backup" ADD CONSTRAINT "Backup_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MinecraftServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleExecution" ADD CONSTRAINT "ScheduleExecution_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerMetric" ADD CONSTRAINT "ServerMetric_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MinecraftServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentEvent" ADD CONSTRAINT "AgentEvent_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAuditEvent" ADD CONSTRAINT "FileAuditEvent_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "MinecraftServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
