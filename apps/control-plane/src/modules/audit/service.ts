import type { PrismaClient, AuditSeverity } from "@mccore/database";
import { ulid } from "@mccore/contracts";

export interface RecordAuditInput {
  actorUserId?: string | null;
  actorIsSystem?: boolean;
  action: string;
  description: string;
  targetType?: string;
  targetLabel?: string;
  serverId?: string;
  resourceId?: string;
  severity?: AuditSeverity;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * §45: never pass password/token/secret values into `metadata` — this
 * function doesn't scrub input, so callers are the enforcement point (the
 * logger redaction list in `logger.ts` is a second, independent backstop
 * for anything that reaches structured logs, but AuditLog rows are shown
 * directly in the admin UI so they need to be clean at the call site).
 */
export async function recordAudit(prisma: PrismaClient, input: RecordAuditInput) {
  await prisma.auditLog.create({
    data: {
      id: ulid(),
      actorUserId: input.actorUserId ?? null,
      actorIsSystem: input.actorIsSystem ?? !input.actorUserId,
      action: input.action,
      description: input.description,
      targetType: input.targetType,
      targetLabel: input.targetLabel,
      serverId: input.serverId,
      resourceId: input.resourceId,
      severity: input.severity ?? "INFO",
      ipAddress: input.ipAddress ?? undefined,
      metadata: input.metadata as never,
    },
  });
}
