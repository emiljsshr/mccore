import type { PrismaClient, Prisma } from "@mccore/database";
import { ApiError, ErrorCode, ulid } from "@mccore/contracts";
import { sha256Hex, normalizeHumanCode } from "../../lib/tokens.js";

const MAX_ATTEMPTS = 10;

/**
 * §8/§9: the bootstrap code itself is generated and displayed exactly once
 * by `mccore admin bootstrap-code rotate` (services/agent/cmd/mccore),
 * which writes the SHA-256 hash directly to Postgres — the Control Plane
 * never generates or has access to the plaintext code, and there is no
 * HTTP path that returns it. This module only verifies a candidate and
 * completes setup.
 */

export async function isSetupComplete(prisma: PrismaClient): Promise<boolean> {
  const count = await prisma.user.count();
  return count > 0;
}

/**
 * Verifies a candidate code against the single active BootstrapToken row
 * without consuming it (used to gate step 2→3 of the /setup wizard before
 * the account form is even shown). Rate-limited at the route level in
 * addition to the attempts counter here.
 */
export async function verifyBootstrapCode(prisma: PrismaClient, candidate: string): Promise<void> {
  const token = await prisma.bootstrapToken.findFirst({
    where: { usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!token) throw new ApiError(ErrorCode.BOOTSTRAP_CODE_INVALID, "No active setup code. Run `mccore admin bootstrap-code rotate`.");
  if (token.attempts >= MAX_ATTEMPTS) {
    throw new ApiError(ErrorCode.BOOTSTRAP_CODE_INVALID, "Too many failed attempts. Rotate the setup code.");
  }
  if (token.expiresAt < new Date()) {
    throw new ApiError(ErrorCode.BOOTSTRAP_CODE_EXPIRED, "Setup code has expired.");
  }

  const candidateHash = sha256Hex(normalizeHumanCode(candidate));
  if (candidateHash !== token.codeHash) {
    await prisma.bootstrapToken.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } });
    throw new ApiError(ErrorCode.BOOTSTRAP_CODE_INVALID, "Invalid setup code.");
  }
}

/**
 * Atomically re-validates + consumes the bootstrap token as part of the
 * same transaction that creates the super admin (§9: "Bootstrap Token
 * sofort invalidieren"). Throws if setup was already completed by a
 * concurrent request (prevents a second super admin from a race).
 */
export async function consumeBootstrapCodeForSetup<T>(
  prisma: PrismaClient,
  candidate: string,
  createAdmin: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1935896421)`;
    const existingUsers = await tx.user.count();
    if (existingUsers > 0) {
      throw new ApiError(ErrorCode.SETUP_ALREADY_COMPLETE, "Setup has already been completed.");
    }

    const token = await tx.bootstrapToken.findFirst({ where: { usedAt: null }, orderBy: { createdAt: "desc" } });
    if (!token) throw new ApiError(ErrorCode.BOOTSTRAP_CODE_INVALID, "No active setup code.");
    if (token.attempts >= MAX_ATTEMPTS) {
      throw new ApiError(ErrorCode.BOOTSTRAP_CODE_INVALID, "Too many failed attempts. Rotate the setup code.");
    }
    if (token.expiresAt < new Date()) {
      throw new ApiError(ErrorCode.BOOTSTRAP_CODE_EXPIRED, "Setup code has expired.");
    }

    const candidateHash = sha256Hex(normalizeHumanCode(candidate));
    if (candidateHash !== token.codeHash) {
      await tx.bootstrapToken.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } });
      throw new ApiError(ErrorCode.BOOTSTRAP_CODE_INVALID, "Invalid setup code.");
    }

    await tx.bootstrapToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
    return createAdmin(tx);
  });
}

export function newId() {
  return ulid();
}
