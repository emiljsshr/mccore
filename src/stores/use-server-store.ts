import { create } from "zustand";
import type { Server, ServerStatus } from "@/types";

interface ServerStore {
  servers: Server[];
  getServer: (id: string) => Server | undefined;
  setStatus: (id: string, status: ServerStatus) => void;
  patchServer: (id: string, patch: Partial<Server>) => void;
  addServer: (server: Server) => void;
  removeServer: (id: string) => void;
  duplicateServer: (id: string) => Server | undefined;
}

export const useServerStore = create<ServerStore>((set, get) => ({
  servers: [],
  getServer: (id) => get().servers.find((s) => s.id === id),
  setStatus: (id, status) =>
    set((state) => ({
      servers: state.servers.map((s) => (s.id === id ? { ...s, status } : s)),
    })),
  patchServer: (id, patch) =>
    set((state) => ({
      servers: state.servers.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })),
  addServer: (server) => set((state) => ({ servers: [server, ...state.servers] })),
  removeServer: (id) =>
    set((state) => ({ servers: state.servers.filter((s) => s.id !== id) })),
  duplicateServer: (id) => {
    const source = get().servers.find((s) => s.id === id);
    if (!source) return undefined;
    const copy: Server = {
      ...source,
      id: `${source.id}-copy-${Math.random().toString(36).slice(2, 7)}`,
      name: `${source.name} Copy`,
      status: "offline",
      players: { online: 0, max: source.players.max },
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ servers: [copy, ...state.servers] }));
    return copy;
  },
}));
