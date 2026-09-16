"use client";

import { useServerStore } from "@/stores/use-server-store";
import type { Server } from "@/types";

export function useServer(id: string): Server | undefined {
  return useServerStore((s) => s.getServer(id));
}
