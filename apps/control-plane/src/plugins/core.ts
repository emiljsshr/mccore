import { ApiError, ErrorCode } from "@mccore/contracts";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@mccore/database";
import type { AppConfig } from "../config.js";

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
    prisma: PrismaClient;
  }
}

export default fp(async function corePlugin(app: FastifyInstance, opts: { config: AppConfig; prisma: PrismaClient }) {
  app.decorate("config", opts.config);
  app.decorate("prisma", opts.prisma);

  app.addHook("onRequest", async request => {
    const changesState = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    const websocket = request.headers.upgrade?.toLowerCase() === "websocket";
    if (!changesState && !websocket) return;
    const origin = request.headers.origin;
    if ((origin && origin !== new URL(opts.config.PUBLIC_URL).origin) || request.headers["sec-fetch-site"] === "cross-site") {
      throw new ApiError(ErrorCode.FORBIDDEN, "Cross-origin request rejected.");
    }
  });
  app.addHook("onClose", async () => {
    await opts.prisma.$disconnect();
  });
});
