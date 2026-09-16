import type { Schedule } from "@/types";
import { api, mutation } from "@/lib/api";
import { useScheduleStore } from "@/stores/use-schedule-store";
export async function listSchedules(serverId: string): Promise<Schedule[]> {
  const { schedules } = await api<{ schedules: Schedule[] }>(`/servers/${serverId}/schedules`);
  useScheduleStore.setState(s => ({ schedules: [...s.schedules.filter(b => b.serverId !== serverId), ...schedules] })); return schedules;
}
function schedule(id: string) { const value = useScheduleStore.getState().schedules.find(s => s.id === id); if (!value) throw new Error("Schedule not found. Refresh the page."); return value; }
export async function toggleSchedule(id: string) { await updateSchedule(id, { enabled: !schedule(id).enabled }); }
export async function deleteSchedule(id: string) { await api(`/servers/${schedule(id).serverId}/schedules/${id}`, mutation("DELETE")); useScheduleStore.getState().removeSchedule(id); }
export type CreateScheduleInput = Omit<Schedule, "id" | "nextRun" | "lastRun">;
export async function createSchedule(input: CreateScheduleInput): Promise<Schedule> {
  const { schedule } = await api<{ schedule: Schedule }>(`/servers/${input.serverId}/schedules`, mutation("POST", { ...input, timezone: input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone }));
  useScheduleStore.getState().addSchedule(schedule); return schedule;
}
export async function updateSchedule(id: string, patch: Partial<Schedule>) { const { schedule: updated } = await api<{ schedule: Schedule }>(`/servers/${schedule(id).serverId}/schedules/${id}`, mutation("PATCH", patch)); useScheduleStore.getState().patchSchedule(id, updated); }
