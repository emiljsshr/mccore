import type { FastifyInstance } from "fastify";
import { ApiError, ErrorCode, ulid, CreateApiKeyInputSchema } from "@mccore/contracts";
import { toApiKeyDto } from "./service.js";
import { recordAudit } from "../audit/service.js";
import { randomToken, sha256Hex } from "../../lib/tokens.js";

const KEY_PREFIX = "mck_live_";

export default async function apiKeysRoutes(app: FastifyInstance) {
  app.get("/api/v1/api-keys", { preHandler: app.requirePermission("api.manage") }, async (request) => {
    const rows = await app.prisma.apiKey.findMany({
      where: { userId: request.user!.id },
      orderBy: { createdAt: "desc" },
    });
    return { apiKeys: rows.map(toApiKeyDto) };
  });

  app.post("/api/v1/api-keys", { preHandler: app.requirePermission("api.manage") }, async (request) => {
    const input = CreateApiKeyInputSchema.parse(request.body);

    const secret = randomToken(32);
    const rawKey = `${KEY_PREFIX}${secret}`;
    const keyPreview = `${KEY_PREFIX}${secret.slice(0, 6)}`;
    const keyHash = sha256Hex(rawKey);
    const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000) : null;

    const created = await app.prisma.apiKey.create({
      data: {
        id: ulid(),
        userId: request.user!.id,
        label: input.label,
        scopes: input.scopes,
        keyHash,
        keyPreview,
        expiresAt,
      },
    });

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "apikey.created",
      description: `${request.user!.name} created API key "${created.label}".`,
      targetLabel: created.label,
      resourceId: created.id,
      severity: "SUCCESS",
      ipAddress: request.ip,
    });

    // `rawKey` is retrievable exactly once — this response — and is never
    // logged or persisted anywhere; only its SHA-256 hash is stored.
    return { apiKey: toApiKeyDto(created), rawKey };
  });

  app.delete("/api/v1/api-keys/:id", { preHandler: app.requirePermission("api.manage") }, async (request) => {
    const { id } = request.params as { id: string };
    const existing = await app.prisma.apiKey.findFirst({ where: { id, userId: request.user!.id } });
    if (!existing) throw new ApiError(ErrorCode.NOT_FOUND, "API key not found.");

    if (!existing.revokedAt) {
      await app.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
      await recordAudit(app.prisma, {
        actorUserId: request.user!.id,
        action: "apikey.revoked",
        description: `${request.user!.name} revoked API key "${existing.label}".`,
        targetLabel: existing.label,
        resourceId: existing.id,
        severity: "WARNING",
        ipAddress: request.ip,
      });
    }

    return { ok: true };
  });
}
