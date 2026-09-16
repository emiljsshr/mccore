import type { FastifyReply } from "fastify";
import type { PrismaClient } from "@mccore/database";
import { ulid } from "@mccore/contracts";
import type { AppConfig } from "../../config.js";
import { randomToken, sha256Hex } from "../../lib/tokens.js";

export interface CreateSessionOptions {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Issues a new opaque session token, stores only its SHA-256 hash, and sets
 * the httpOnly session cookie. §11: session rotation on login — any prior
 * sessions are left untouched (multi-device logins are expected), but
 * `rotateSession` (used after privilege-affecting changes) revokes the old
 * one atomically with issuing the new one.
 */
export async function createSession(prisma: PrismaClient, config: AppConfig, opts: CreateSessionOptions) {
  const token = randomToken(32);
  const session = await prisma.session.create({
    data: {
      id: ulid(),
      userId: opts.userId,
      tokenHash: sha256Hex(token),
      expiresAt: new Date(Date.now() + config.sessionTtlMs),
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
    },
  });
  return { token, session };
}

export function setSessionCookie(reply: FastifyReply, config: AppConfig, token: string, remember = true) {
  reply.setCookie(config.cookieName, token, {
    httpOnly: true,
    secure: new URL(config.PUBLIC_URL).protocol === "https:",
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: Math.floor(config.sessionTtlMs / 1000) } : {}),
  });
}

export function clearSessionCookie(reply: FastifyReply, config: AppConfig) {
  reply.clearCookie(config.cookieName, { path: "/" });
}

export async function revokeSession(prisma: PrismaClient, sessionId: string) {
  await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
}

export async function revokeAllUserSessions(prisma: PrismaClient, userId: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
