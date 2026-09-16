import { create } from "zustand";
import type { Schedule } from "@/types";

interface ScheduleStore {
  schedules: Schedule[];
  addSchedule: (schedule: Schedule) => void;
  patchSchedule: (id: string, patch: Partial<Schedule>) => void;
  removeSchedule: (id: string) => void;
  toggleEnabled: (id: string) => void;
}

export const useScheduleStore = create<ScheduleStore>((set) => ({
  schedules: [],
  addSchedule: (schedule) => set((state) => ({ schedules: [schedule, ...state.schedules] })),
  patchSchedule: (id, patch) =>
    set((state) => ({
      schedules: state.schedules.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })),
  removeSchedule: (id) =>
    set((state) => ({ schedules: state.schedules.filter((s) => s.id !== id) })),
  toggleEnabled: (id) =>
    set((state) => ({
      schedules: state.schedules.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    })),
}));
