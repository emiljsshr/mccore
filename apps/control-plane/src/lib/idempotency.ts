import type { FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@mccore/database";
import { ApiError, ErrorCode } from "@mccore/contracts";
import { sha256Hex } from "./tokens.js";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * §71: doubles-click-proof mutating endpoints. The client sends an
 * `Idempotency-Key` header; if that (userId, endpoint, key) triple was
 * already used, we replay the stored response instead of re-executing —
 * *unless* the request body differs, which is treated as a client bug
 * (reusing a key for a different request) rather than silently ignored.
 */
export async function withIdempotency<T>(
  prisma: PrismaClient,
  request: FastifyRequest,
  reply: FastifyReply,
  handler: () => Promise<T>
): Promise<T> {
  const key = request.headers["idempotency-key"];
  if (!key || typeof key !== "string") {
    return handler();
  }
  const compositeKey = `${request.user?.id ?? "anon"}:${request.routeOptions?.url ?? request.url}:${key}`;
  const bodyHash = sha256Hex(JSON.stringify(request.body ?? {}));

  const existing = await prisma.idempotencyKey.findUnique({ where: { key: compositeKey } });
  if (existing) {
    if (existing.expiresAt < new Date()) {
      await prisma.idempotencyKey.delete({ where: { key: compositeKey } }).catch(() => undefined);
    } else {
      const storedHash = (existing.responseSnapshot as { bodyHash?: string } | null)?.bodyHash;
      if (storedHash && storedHash !== bodyHash) {
        throw new ApiError(ErrorCode.IDEMPOTENCY_KEY_REUSED, "Idempotency-Key was already used with a different request body.");
      }
      reply.status(existing.responseStatus ?? 200);
      return (existing.responseSnapshot as { body?: T } | null)?.body as T;
    }
  }

  const result = await handler();
  await prisma.idempotencyKey
    .create({
      data: {
        key: compositeKey,
        userId: request.user?.id ?? "anonymous",
        endpoint: request.routeOptions?.url ?? request.url,
        responseStatus: reply.statusCode,
        responseSnapshot: { bodyHash, body: result } as never,
        expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
      },
    })
    .catch(() => undefined); // best-effort; never fail the request over bookkeeping
  return result;
}
