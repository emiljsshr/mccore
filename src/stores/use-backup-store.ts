import { create } from "zustand";
import type { Backup } from "@/types";

interface BackupStore {
  backups: Backup[];
  addBackup: (backup: Backup) => void;
  patchBackup: (id: string, patch: Partial<Backup>) => void;
  removeBackup: (id: string) => void;
}

export const useBackupStore = create<BackupStore>((set) => ({
  backups: [],
  addBackup: (backup) => set((state) => ({ backups: [backup, ...state.backups] })),
  patchBackup: (id, patch) =>
    set((state) => ({
      backups: state.backups.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    })),
  removeBackup: (id) => set((state) => ({ backups: state.backups.filter((b) => b.id !== id) })),
}));
