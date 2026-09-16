import { create } from "zustand";
import type { Player } from "@/types";

interface PlayerStore {
  players: Player[];
  patchPlayer: (id: string, patch: Partial<Player>) => void;
  banPlayer: (id: string, reason: string, bannedBy: string) => void;
  unbanPlayer: (id: string) => void;
  kickPlayer: (id: string) => void;
  toggleOperator: (id: string) => void;
  toggleWhitelist: (id: string) => void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  players: [],
  patchPlayer: (id, patch) =>
    set((state) => ({
      players: state.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),
  banPlayer: (id, reason, bannedBy) =>
    set((state) => ({
      players: state.players.map((p) =>
        p.id === id
          ? { ...p, banned: true, banReason: reason, bannedBy, online: false, serverId: undefined }
          : p,
      ),
    })),
  unbanPlayer: (id) =>
    set((state) => ({
      players: state.players.map((p) =>
        p.id === id ? { ...p, banned: false, banReason: undefined, bannedBy: undefined } : p,
      ),
    })),
  kickPlayer: (id) =>
    set((state) => ({
      players: state.players.map((p) =>
        p.id === id ? { ...p, online: false, serverId: undefined, position: undefined } : p,
      ),
    })),
  toggleOperator: (id) =>
    set((state) => ({
      players: state.players.map((p) => (p.id === id ? { ...p, operator: !p.operator } : p)),
    })),
  toggleWhitelist: (id) =>
    set((state) => ({
      players: state.players.map((p) => (p.id === id ? { ...p, whitelisted: !p.whitelisted } : p)),
    })),
}));
