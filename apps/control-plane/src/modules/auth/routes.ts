import type { FastifyInstance } from "fastify";
import type { Prisma } from "@mccore/database";
import { ApiError, ErrorCode, ulid } from "@mccore/contracts";
import type { SessionUserDto } from "@mccore/contracts";
import {
  VerifyBootstrapCodeSchema,
  CompleteSetupSchema,
  LoginSchema,
  ChangePasswordSchema,
  RequestPasswordResetSchema,
  ConfirmPasswordResetSchema,
  VerifyTotpSchema,
} from "./schemas.js";
import { isSetupComplete, verifyBootstrapCode, consumeBootstrapCodeForSetup } from "./bootstrap.js";
import { hashPassword, verifyPassword, validatePasswordStrength } from "./password.js";
import { createSession, setSessionCookie, clearSessionCookie, revokeSession, revokeAllUserSessions } from "./service.js";
import { loadSessionUser } from "./session-context.js";
import { startTotpSetup, verifyTotpCode, enableTotp, disableTotp, consumeRecoveryCode } from "./totp.js";
import { recordAudit } from "../audit/service.js";
import { randomToken, sha256Hex } from "../../lib/tokens.js";

function toSessionUserDto(ctx: Awaited<ReturnType<typeof loadSessionUser>>): SessionUserDto | null {
  if (!ctx) return null;
  const { permissionSet: _permissionSet, ...dto } = ctx;
  return dto;
}

export default async function authRoutes(app: FastifyInstance) {
  // ---------------------------------------------------------------- Setup --

  app.get("/api/v1/setup/status", async () => {
    const complete = await isSetupComplete(app.prisma);
    return { complete };
  });

  app.post(
    "/api/v1/setup/verify-code",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request) => {
      const { code } = VerifyBootstrapCodeSchema.parse(request.body);
      await verifyBootstrapCode(app.prisma, code);
      return { valid: true };
    }
  );

  app.post(
    "/api/v1/setup/complete",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const input = CompleteSetupSchema.parse(request.body);
      const strengthError = validatePasswordStrength(input.password);
      if (strengthError) throw new ApiError(ErrorCode.PASSWORD_TOO_WEAK, strengthError);

      if (await isSetupComplete(app.prisma)) throw new ApiError(ErrorCode.SETUP_ALREADY_COMPLETE, "Setup has already been completed.");
      await verifyBootstrapCode(app.prisma, input.code);

      const ownerRole = await app.prisma.role.findUnique({ where: { name: "owner" } });
      if (!ownerRole) throw new ApiError(ErrorCode.INTERNAL_ERROR, "Owner role is not seeded.");

      const passwordHash = await hashPassword(input.password);
      const userId = ulid();
      const user = await consumeBootstrapCodeForSetup(app.prisma, input.code, async (tx: Prisma.TransactionClient) => {
        const created = await tx.user.create({
          data: {
            id: userId,
            name: input.name,
            email: input.email,
            passwordHash,
            avatarSeed: userId,
            isSuperAdmin: true,
            status: "ACTIVE",
          },
        });
        await tx.userRole.create({ data: { userId, roleId: ownerRole.id } });
        return created;
      });

      await recordAudit(app.prisma, {
        actorUserId: user.id,
        action: "setup.completed",
        description: `${user.name} completed initial setup and became the super administrator.`,
        targetType: "user",
        targetLabel: user.name,
        severity: "SUCCESS",
        ipAddress: request.ip,
      });

      const { token } = await createSession(app.prisma, app.config, { userId: user.id, ipAddress: request.ip, userAgent: request.headers["user-agent"] });
      setSessionCookie(reply, app.config, token);

      const ctx = await loadSessionUser(app.prisma, user.id);
      return { user: toSessionUserDto(ctx) };
    }
  );

  // ----------------------------------------------------------------- Auth --

  app.post("/api/v1/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const input = LoginSchema.parse(request.body);
    const user = await app.prisma.user.findUnique({ where: { email: input.email }, include: { twoFactor: true } });

    // Constant-shape response whether the email exists or not, to avoid
    // leaking account existence through timing/response differences.
    const genericInvalid = () => new ApiError(ErrorCode.INVALID_CREDENTIALS, "Invalid email or password.");

    if (!user) {
      await hashPassword(input.password).catch(() => undefined); // keep timing roughly comparable
      throw genericInvalid();
    }
    if (user.status === "SUSPENDED") {
      throw new ApiError(ErrorCode.ACCOUNT_SUSPENDED, "This account has been suspended.");
    }

    const validPassword = await verifyPassword(user.passwordHash, input.password);
    if (!validPassword) {
      await recordAudit(app.prisma, {
        actorUserId: user.id,
        action: "auth.login.failed",
        description: `Failed login attempt for ${user.email}.`,
        targetType: "user",
        severity: "WARNING",
        ipAddress: request.ip,
      });
      throw genericInvalid();
    }

    if (user.twoFactor?.enabled) {
      let ok = false;
      if (input.totpCode) {
        ok = await verifyTotpCode(app.prisma, app.config.ENCRYPTION_KEY, user.id, user.email, input.totpCode);
      } else if (input.recoveryCode) {
        ok = await consumeRecoveryCode(app.prisma, user.id, input.recoveryCode);
      } else {
        throw new ApiError(ErrorCode.TOTP_REQUIRED, "Two-factor authentication code required.");
      }
      if (!ok) throw new ApiError(ErrorCode.TOTP_INVALID, "Invalid two-factor code.");
    }

    const { token } = await createSession(app.prisma, app.config, { userId: user.id, ipAddress: request.ip, userAgent: request.headers["user-agent"] });
    setSessionCookie(reply, app.config, token, input.remember);
    await app.prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });

    await recordAudit(app.prisma, {
      actorUserId: user.id,
      action: "auth.login",
      description: `${user.name} signed in.`,
      targetType: "user",
      severity: "SUCCESS",
      ipAddress: request.ip,
    });

    const ctx = await loadSessionUser(app.prisma, user.id);
    return { user: toSessionUserDto(ctx) };
  });

  app.get("/api/v1/auth/sessions", { preHandler: app.authenticate }, async request => {
    const sessions = await app.prisma.session.findMany({ where: { userId: request.user!.id, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastSeenAt: true } });
    return { sessions: sessions.map(session => ({ ...session, current: session.id === request.sessionId })) };
  });
  app.delete("/api/v1/auth/sessions/:id", { preHandler: app.authenticate }, async request => {
    const { id } = request.params as { id: string };
    await app.prisma.session.updateMany({ where: { id, userId: request.user!.id }, data: { revokedAt: new Date() } });
    return { ok: true };
  });
  app.patch("/api/v1/auth/profile", { preHandler: app.authenticate }, async request => {
    const name = (request.body as { name?: unknown })?.name;
    if (typeof name !== "string" || !name.trim() || name.length > 96) throw new ApiError(ErrorCode.VALIDATION_ERROR, "Name must contain 1–96 characters.");
    await app.prisma.user.update({ where: { id: request.user!.id }, data: { name: name.trim() } });
    return { user: toSessionUserDto(await loadSessionUser(app.prisma, request.user!.id)) };
  });
  app.post("/api/v1/auth/logout", { preHandler: app.authenticate }, async (request, reply) => {
    if (request.sessionId) await revokeSession(app.prisma, request.sessionId);
    clearSessionCookie(reply, app.config);
    return { ok: true };
  });

  app.get("/api/v1/auth/session", { preHandler: app.authenticate }, async (request) => {
    return { user: toSessionUserDto(request.user!) };
  });

  app.post("/api/v1/auth/change-password", { preHandler: app.authenticate }, async (request, reply) => {
    const input = ChangePasswordSchema.parse(request.body);
    const user = await app.prisma.user.findUniqueOrThrow({ where: { id: request.user!.id } });

    const valid = await verifyPassword(user.passwordHash, input.currentPassword);
    if (!valid) throw new ApiError(ErrorCode.INVALID_CREDENTIALS, "Current password is incorrect.");

    const strengthError = validatePasswordStrength(input.newPassword);
    if (strengthError) throw new ApiError(ErrorCode.PASSWORD_TOO_WEAK, strengthError);

    const passwordHash = await hashPassword(input.newPassword);
    await app.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await revokeAllUserSessions(app.prisma, user.id);

    await recordAudit(app.prisma, {
      actorUserId: user.id,
      action: "auth.password_changed",
      description: `${user.name} changed their password.`,
      targetType: "user",
      severity: "INFO",
      ipAddress: request.ip,
    });

    // Issue a fresh session for the current device so the user isn't
    // logged out by the very request that changed their password.
    const { token } = await createSession(app.prisma, app.config, { userId: user.id, ipAddress: request.ip, userAgent: request.headers["user-agent"] });
    setSessionCookie(reply, app.config, token);
    return { ok: true };
  });

  // --------------------------------------------------------- Password reset --

  app.post(
    "/api/v1/auth/password-reset/request",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request) => {
      const { email } = RequestPasswordResetSchema.parse(request.body);
      const user = await app.prisma.user.findUnique({ where: { email } });
      if (user) {
        const token = randomToken(32);
        await app.prisma.passwordResetToken.create({
          data: {
            id: ulid(),
            userId: user.id,
            tokenHash: sha256Hex(token),
            expiresAt: new Date(Date.now() + app.config.passwordResetTtlMs),
          },
        });
        // No mail server is provisioned yet (§11) — the token exists so
        // the reset flow is real, but delivery is administrative: an
        // operator retrieves it via `mccore admin password-reset <email>`.
        // It is never returned by this endpoint or written to logs.
        request.log.info({ userId: user.id }, "password reset token issued");
      }
      // Always the same response — don't reveal whether the email exists.
      return { ok: true };
    }
  );

  app.post(
    "/api/v1/auth/password-reset/confirm",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request) => {
      const input = ConfirmPasswordResetSchema.parse(request.body);
      const tokenHash = sha256Hex(input.token);
      const record = await app.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
      if (!record || record.usedAt || record.expiresAt < new Date()) {
        throw new ApiError(ErrorCode.BOOTSTRAP_CODE_INVALID, "This reset link is invalid or has expired.");
      }
      const strengthError = validatePasswordStrength(input.newPassword);
      if (strengthError) throw new ApiError(ErrorCode.PASSWORD_TOO_WEAK, strengthError);

      const passwordHash = await hashPassword(input.newPassword);
      await app.prisma.$transaction(async tx => {
        const claimed = await tx.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
        if (claimed.count !== 1) throw new ApiError(ErrorCode.CONFLICT, "This reset link was already used.");
        await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
        await tx.user.updateMany({ where: { id: record.userId, status: "INVITED" }, data: { status: "ACTIVE" } });
      });
      await revokeAllUserSessions(app.prisma, record.userId);
      await recordAudit(app.prisma, {
        actorUserId: record.userId,
        action: "auth.password_reset",
        description: "Password was reset via reset link.",
        targetType: "user",
        severity: "WARNING",
      });
      return { ok: true };
    }
  );

  // ------------------------------------------------------------------ TOTP --

  app.post("/api/v1/auth/2fa/setup", { preHandler: app.authenticate }, async (request) => {
    const user = request.user!;
    const result = await startTotpSetup(app.prisma, app.config.ENCRYPTION_KEY, user.id, user.email);
    return { otpauthUri: result.otpauthUri, qrDataUrl: result.qrDataUrl, secret: result.secret };
  });

  app.post("/api/v1/auth/2fa/enable", { preHandler: app.authenticate }, async (request) => {
    const user = request.user!;
    const { code } = VerifyTotpSchema.parse(request.body);
    const valid = await verifyTotpCode(app.prisma, app.config.ENCRYPTION_KEY, user.id, user.email, code);
    if (!valid) throw new ApiError(ErrorCode.TOTP_INVALID, "Invalid two-factor code.");
    const recoveryCodes = await enableTotp(app.prisma, user.id);
    await recordAudit(app.prisma, {
      actorUserId: user.id,
      action: "auth.2fa_enabled",
      description: `${user.name} enabled two-factor authentication.`,
      targetType: "user",
      severity: "SUCCESS",
      ipAddress: request.ip,
    });
    return { recoveryCodes };
  });

  app.post("/api/v1/auth/2fa/disable", { preHandler: app.authenticate }, async (request) => {
    const user = request.user!;
    const { code } = VerifyTotpSchema.parse(request.body);
    if (!await verifyTotpCode(app.prisma, app.config.ENCRYPTION_KEY, user.id, user.email, code)) throw new ApiError(ErrorCode.TOTP_INVALID, "Invalid two-factor code.");
    await disableTotp(app.prisma, user.id);
    await recordAudit(app.prisma, {
      actorUserId: user.id,
      action: "auth.2fa_disabled",
      description: `${user.name} disabled two-factor authentication.`,
      targetType: "user",
      severity: "WARNING",
      ipAddress: request.ip,
    });
    return { ok: true };
  });
}
