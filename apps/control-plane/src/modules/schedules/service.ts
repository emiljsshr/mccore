import type { Schedule } from "@mccore/database";
import type { ScheduleDto } from "@mccore/contracts";

export function toScheduleDto(schedule: Schedule): ScheduleDto {
  return {
    id: schedule.id,
    serverId: schedule.serverId,
    name: schedule.name,
    action: schedule.action as ScheduleDto["action"],
    commandPayload: schedule.commandPayload ?? undefined,
    scheduleDescription: schedule.cronExpression,
    cronExpression: schedule.cronExpression,
    timezone: schedule.timezone,
    enabled: schedule.enabled,
    nextRun: schedule.nextRunAt?.toISOString() ?? "",
    lastRun: schedule.lastRunAt?.toISOString() ?? undefined,
  };
}
