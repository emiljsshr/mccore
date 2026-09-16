import { create } from "zustand";
import type { SessionUserDto } from "@mccore/contracts";
export const useSessionStore = create<{ user: SessionUserDto | null }>(() => ({ user: null }));
