import operationRoutes from "./modules/operations/routes.js";
import Fastify, { type FastifyBaseLogger } from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import websocketPlugin from "@fastify/websocket";
import type { PrismaClient } from "@mccore/database";
import { ulid } from "@mccore/contracts";
import type { AppConfig } from "./config.js";
import { createLogger, type Logger } from "./logger.js";
import corePlugin from "./plugins/core.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import authPlugin from "./plugins/auth.js";
import authRoutes from "./modules/auth/routes.js";
import usersRoutes from "./modules/users/routes.js";
import nodesRoutes from "./modules/nodes/routes.js";
import serversRoutes from "./modules/servers/routes.js";
import playersRoutes from "./modules/players/routes.js";
import filesRoutes from "./modules/files/routes.js";
import backupsRoutes from "./modules/backups/routes.js";
import pluginsRoutes from "./modules/plugins/routes.js";
import worldsRoutes from "./modules/worlds/routes.js";
import schedulesRoutes from "./modules/schedules/routes.js";
import networksRoutes from "./modules/networks/routes.js";
import auditRoutes from "./modules/audit/routes.js";
import notificationsRoutes from "./modules/notifications/routes.js";
import apiKeysRoutes from "./modules/apikeys/routes.js";
import settingsRoutes from "./modules/settings/routes.js";
import metricsRoutes from "./modules/metrics/routes.js";
import liveWsPlugin from "./ws/live-hub.js";
import agentWsPlugin from "./ws/agent-hub.js";
import invseePlugin from "./modules/players/invsee.js";
import worldStatsPlugin from "./modules/players/worldstats.js";
import { registerScheduler } from "./modules/schedules/scheduler.js";

export interface BuildAppOptions {
  config: AppConfig;
  prisma: PrismaClient;
  logger?: Logger | boolean;
  startScheduler?: boolean;
}

export async function buildApp(opts: BuildAppOptions) {
  const app = Fastify({
    ...(opts.logger === false ? { logger: false as const } : { loggerInstance: (typeof opts.logger === "object" ? opts.logger : createLogger(opts.config)) as FastifyBaseLogger }),
    genReqId: () => ulid(),
    trustProxy: "loopback",
    bodyLimit: 10 * 1024 * 1024, // 10MB; large file uploads use a dedicated streaming route
  });

  await app.register(corePlugin, { config: opts.config, prisma: opts.prisma });
  await app.register(errorHandlerPlugin);
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(websocketPlugin);
  await app.register(authPlugin);

  app.get("/health/live", async () => ({ status: "ok" }));
  app.get("/health/ready", async (_request, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      return { status: "ok" };
    } catch (err) {
      app.log.error({ err }, "readiness check failed");
      return reply.status(503).send({ status: "unavailable" });
    }
  });

  await app.register(authRoutes);
  await app.register(operationRoutes);
  await app.register(usersRoutes);
  await app.register(nodesRoutes);
  await app.register(serversRoutes);
  await app.register(invseePlugin);
  await app.register(worldStatsPlugin);
  await app.register(playersRoutes);
  await app.register(filesRoutes);
  await app.register(backupsRoutes);
  await app.register(pluginsRoutes);
  await app.register(worldsRoutes);
  await app.register(schedulesRoutes);
  await app.register(networksRoutes);
  await app.register(auditRoutes);
  await app.register(notificationsRoutes);
  await app.register(apiKeysRoutes);
  await app.register(settingsRoutes);
  await app.register(metricsRoutes);

  await app.register(liveWsPlugin);
  await app.register(agentWsPlugin);

  if (opts.startScheduler) {
    registerScheduler(app);
  }

  return app;
}
