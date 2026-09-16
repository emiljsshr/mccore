import { create } from "zustand";
import type { InstalledPlugin, PluginStatus } from "@/types";

interface PluginStore {
  plugins: InstalledPlugin[];
  setStatus: (id: string, status: PluginStatus) => void;
  removePlugin: (id: string) => void;
  addPlugin: (plugin: InstalledPlugin) => void;
  updatePlugin: (id: string) => void;
}

export const usePluginStore = create<PluginStore>((set) => ({
  plugins: [],
  setStatus: (id, status) =>
    set((state) => ({
      plugins: state.plugins.map((p) => (p.id === id ? { ...p, status } : p)),
    })),
  removePlugin: (id) =>
    set((state) => ({ plugins: state.plugins.filter((p) => p.id !== id) })),
  addPlugin: (plugin) => set((state) => ({ plugins: [plugin, ...state.plugins] })),
  updatePlugin: (id) =>
    set((state) => ({
      plugins: state.plugins.map((p) =>
        p.id === id && p.latestVersion
          ? { ...p, version: p.latestVersion, updateAvailable: false }
          : p,
      ),
    })),
}));
