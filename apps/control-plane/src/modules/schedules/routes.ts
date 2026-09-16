import type { FastifyInstance } from "fastify";
import { ApiError, ErrorCode, ulid, CreateScheduleInputSchema } from "@mccore/contracts";
import { assertServerAccessible, requireServer } from "../servers/service.js";
import { toScheduleDto } from "./service.js";
import { computeNextRun } from "../../lib/cron.js";
import { recordAudit } from "../audit/service.js";

const UpdateScheduleSchema = CreateScheduleInputSchema.partial();

export default async function schedulesRoutes(app: FastifyInstance) {
  app.get("/api/v1/servers/:id/schedules", { preHandler: app.requirePermission("schedules.view") }, async (request) => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);
    const schedules = await app.prisma.schedule.findMany({ where: { serverId: id }, orderBy: { createdAt: "desc" } });
    return { schedules: schedules.map(toScheduleDto) };
  });

  app.post("/api/v1/servers/:id/schedules", { preHandler: app.requirePermission("schedules.manage") }, async (request) => {
    const { id } = request.params as { id: string };
    assertServerAccessible(request, id);
    await requireServer(app.prisma, id);
    const input = CreateScheduleInputSchema.parse(request.body);
    if (input.action === "command" && !input.commandPayload) {
      throw new ApiError(ErrorCode.VALIDATION_ERROR, "commandPayload is required for the 'command' action.");
    }
    if (input.action === "message" && !input.commandPayload) {
      throw new ApiError(ErrorCode.VALIDATION_ERROR, "commandPayload is required for the 'message' action.");
    }

    const nextRunAt = computeNextRun(input.cronExpression, input.timezone);
    const schedule = await app.prisma.schedule.create({
      data: {
        id: ulid(),
        serverId: id,
        name: input.name,
        action: input.action,
        commandPayload: input.commandPayload,
        cronExpression: input.cronExpression,
        timezone: input.timezone,
        enabled: input.enabled,
        nextRunAt: input.enabled ? nextRunAt : null,
        createdByUserId: request.user!.id,
      },
    });

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "schedule.created",
      description: `${request.user!.name} created schedule "${schedule.name}".`,
      targetType: "schedule",
      targetLabel: schedule.name,
      serverId: id,
      severity: "INFO",
      ipAddress: request.ip,
    });

    return { schedule: toScheduleDto(schedule) };
  });

  app.patch("/api/v1/servers/:id/schedules/:scheduleId", { preHandler: app.requirePermission("schedules.manage") }, async (request) => {
    const { id, scheduleId } = request.params as { id: string; scheduleId: string };
    assertServerAccessible(request, id);
    const existing = await app.prisma.schedule.findFirst({ where: { id: scheduleId, serverId: id } });
    if (!existing) throw new ApiError(ErrorCode.NOT_FOUND, "Schedule not found.");

    const input = UpdateScheduleSchema.parse(request.body);
    const cronExpression = input.cronExpression ?? existing.cronExpression;
    const timezone = input.timezone ?? existing.timezone;
    const enabled = input.enabled ?? existing.enabled;
    const nextRunAt = enabled ? computeNextRun(cronExpression, timezone) : null;

    const schedule = await app.prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        name: input.name ?? existing.name,
        action: input.action ?? existing.action,
        commandPayload: input.commandPayload ?? existing.commandPayload,
        cronExpression,
        timezone,
        enabled,
        nextRunAt,
      },
    });

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "schedule.updated",
      description: `${request.user!.name} updated schedule "${schedule.name}".`,
      targetType: "schedule",
      targetLabel: schedule.name,
      serverId: id,
      severity: "INFO",
      ipAddress: request.ip,
    });

    return { schedule: toScheduleDto(schedule) };
  });

  app.delete("/api/v1/servers/:id/schedules/:scheduleId", { preHandler: app.requirePermission("schedules.manage") }, async (request) => {
    const { id, scheduleId } = request.params as { id: string; scheduleId: string };
    assertServerAccessible(request, id);
    const existing = await app.prisma.schedule.findFirst({ where: { id: scheduleId, serverId: id } });
    if (!existing) throw new ApiError(ErrorCode.NOT_FOUND, "Schedule not found.");
    await app.prisma.schedule.delete({ where: { id: scheduleId } });

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "schedule.deleted",
      description: `${request.user!.name} deleted schedule "${existing.name}".`,
      targetType: "schedule",
      targetLabel: existing.name,
      serverId: id,
      severity: "WARNING",
      ipAddress: request.ip,
    });
    return { ok: true };
  });

  app.get(
    "/api/v1/servers/:id/schedules/:scheduleId/executions",
    { preHandler: app.requirePermission("schedules.view") },
    async (request) => {
      const { id, scheduleId } = request.params as { id: string; scheduleId: string };
      assertServerAccessible(request, id);
      const executions = await app.prisma.scheduleExecution.findMany({
        where: { scheduleId },
        orderBy: { startedAt: "desc" },
        take: 50,
      });
      return { executions };
    }
  );
}
