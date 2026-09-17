import { scopePermissions } from "../modules/apikeys/scopes.js";
import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ApiError, ErrorCode } from "@mccore/contracts";
import { sha256Hex } from "../lib/tokens.js";
import { loadSessionUser, hasPermission, canAccessServer, type SessionContext } from "../modules/auth/session-context.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: SessionContext;
    sessionId?: string;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePermission: (permissionId: string) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireServerAccess: (
      getServerId: (request: FastifyRequest) => string
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async function authPlugin(app: FastifyInstance) {
  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    const authorization = request.headers.authorization;
    if (authorization?.startsWith("Bearer ")) {
      const key = await app.prisma.apiKey.findUnique({ where: { keyHash: sha256Hex(authorization.slice(7)) } });
      if (!key || key.revokedAt || (key.expiresAt && key.expiresAt <= new Date())) throw new ApiError(ErrorCode.UNAUTHENTICATED, "Invalid API key.");
      const ctx = await loadSessionUser(app.prisma, key.userId);
      if (!ctx) throw new ApiError(ErrorCode.UNAUTHENTICATED, "Account is no longer active.");
      const permissions = [...new Set(key.scopes.flatMap(scope => scopePermissions[scope] ?? []))].filter(p => hasPermission(ctx, p));
      request.user = { ...ctx, isSuperAdmin: false, permissions, permissionSet: new Set(permissions) };
      await app.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
      return;
    }
    const token = request.cookies[app.config.cookieName];
    if (!token) throw new ApiError(ErrorCode.UNAUTHENTICATED, "Not authenticated.");

    const tokenHash = sha256Hex(token);
    const session = await app.prisma.session.findUnique({ where: { tokenHash } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      // The cookie itself is presented as evidence of a session by the
      // proxy's cheap presence-only check (src/proxy.ts) — leaving a dead
      // cookie on the client after it fails real validation here makes the
      // proxy redirect to /login while the client believes it's logged in,
      // bouncing forever between /login and /dashboard. Clearing it here
      // breaks that loop on the very first 401.
      reply.clearCookie(app.config.cookieName, { path: "/" });
      throw new ApiError(ErrorCode.UNAUTHENTICATED, "Session expired or invalid.");
    }

    const ctx = await loadSessionUser(app.prisma, session.userId);
    if (!ctx) {
      reply.clearCookie(app.config.cookieName, { path: "/" });
      throw new ApiError(ErrorCode.ACCOUNT_SUSPENDED, "Account is no longer active.");
    }

    request.user = ctx;
    request.sessionId = session.id;

    // Sliding activity timestamp; cheap fire-and-forget, not on the
    // request's critical path.
    void app.prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch((err: unknown) => request.log.warn({ err }, "failed to update session lastSeenAt"));
  });

  app.decorate("requirePermission", (permissionId: string) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      await app.authenticate(request, reply);
      if (!request.user || !hasPermission(request.user, permissionId)) {
        throw new ApiError(ErrorCode.FORBIDDEN, `Missing permission: ${permissionId}`);
      }
    };
  });

  app.decorate("requireServerAccess", (getServerId: (request: FastifyRequest) => string) => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      if (!request.user) throw new ApiError(ErrorCode.UNAUTHENTICATED, "Not authenticated.");
      const serverId = getServerId(request);
      if (!canAccessServer(request.user, serverId)) {
        throw new ApiError(ErrorCode.FORBIDDEN, "No access to this server.");
      }
    };
  });
});
