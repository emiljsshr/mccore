import type { PrismaClient } from "@mccore/database";
import { ulid } from "@mccore/contracts";
import type { OperationDto } from "@mccore/contracts";

export async function createOperation(
  prisma: PrismaClient,
  input: { type: string; resourceId: string; createdByUserId?: string; idempotencyKey?: string; metadata?: Record<string, unknown> }
) {
  return prisma.operation.create({
    data: {
      id: ulid(),
      type: input.type,
      resourceId: input.resourceId,
      status: "PENDING",
      progress: 0,
      createdByUserId: input.createdByUserId,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata as never,
    },
  });
}

export async function updateOperation(
  prisma: PrismaClient,
  id: string,
  patch: { status?: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED"; progress?: number; message?: string; errorCode?: string }
) {
  const data: Record<string, unknown> = { ...patch };
  if (patch.status === "RUNNING") data.startedAt = new Date();
  if (patch.status === "SUCCEEDED" || patch.status === "FAILED" || patch.status === "CANCELLED") {
    data.completedAt = new Date();
  }
  return prisma.operation.update({ where: { id }, data });
}

export function toOperationDto(op: {
  id: string;
  type: string;
  resourceId: string;
  status: string;
  progress: number;
  message: string | null;
  errorCode: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}): OperationDto {
  return {
    id: op.id,
    type: op.type as OperationDto["type"],
    resourceId: op.resourceId,
    status: op.status as OperationDto["status"],
    progress: op.progress,
    message: op.message ?? undefined,
    errorCode: op.errorCode ?? undefined,
    createdAt: op.createdAt.toISOString(),
    startedAt: op.startedAt?.toISOString(),
    completedAt: op.completedAt?.toISOString(),
  };
}
