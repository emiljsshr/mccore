import { assertServerAccessible } from "../servers/service.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AuditSeveritySchema } from "@mccore/contracts";
import type { AuditEventDto } from "@mccore/contracts";
import type { AuditLog, AuditSeverity, Prisma } from "@mccore/database";

const AuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "before must be a valid ISO timestamp")
    .optional(),
  serverId: z.string().optional(),
  severity: AuditSeveritySchema.optional(),
});

const SYSTEM_ACTOR = { id: "system", name: "mcCore", avatarSeed: "system", isSystem: true } as const;

function toAuditEventDto(row: AuditLog, actorNameById: Map<string, string>): AuditEventDto {
  const actor = row.actorIsSystem
    ? SYSTEM_ACTOR
    : row.actorUserId
      ? {
          id: row.actorUserId,
          // §45/audit: `avatarSeed` mirrors the user's own id, matching the
          // convention set by `avatarSeed: userId` at account creation
          // (see modules/users/routes.ts, modules/auth/routes.ts bootstrap).
          name: actorNameById.get(row.actorUserId) ?? "Deleted user",
          avatarSeed: row.actorUserId,
          isSystem: false,
        }
      : SYSTEM_ACTOR;

  return {
    id: row.id,
    actor,
    action: row.action,
    description: row.description,
    targetType: (row.targetType ?? undefined) as AuditEventDto["targetType"],
    targetLabel: row.targetLabel ?? undefined,
    serverId: row.serverId ?? undefined,
    severity: row.severity.toLowerCase() as AuditEventDto["severity"],
    timestamp: row.createdAt.toISOString(),
  };
}

export default async function auditRoutes(app: FastifyInstance) {
  app.get("/api/v1/audit", { preHandler: app.requirePermission("audit.view") }, async (request) => {
    const query = AuditQuerySchema.parse(request.query);

    const where: Prisma.AuditLogWhereInput = {};
    const scope = request.user!.serverIds;
    if (scope !== null) where.serverId = { in: scope };
    if (query.serverId) { assertServerAccessible(request, query.serverId); where.serverId = query.serverId; }
    if (query.severity) where.severity = query.severity.toUpperCase() as AuditSeverity;
    if (query.before) where.createdAt = { lt: new Date(query.before) };

    const rows: AuditLog[] = await app.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query.limit,
    });

    const actorIds = Array.from(
      new Set(rows.filter((r: AuditLog) => !r.actorIsSystem && r.actorUserId).map((r: AuditLog) => r.actorUserId as string))
    );
    const actors: Array<{ id: string; name: string }> =
      actorIds.length > 0 ? await app.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];
    const actorNameById = new Map<string, string>(actors.map((a) => [a.id, a.name]));

    const events = rows.map((row: AuditLog) => toAuditEventDto(row, actorNameById));
    const last = rows[rows.length - 1];
    const nextCursor = rows.length === query.limit && last ? last.createdAt.toISOString() : null;

    return { events, nextCursor };
  });
}
