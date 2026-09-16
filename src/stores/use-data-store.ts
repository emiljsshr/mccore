import { create } from "zustand";
import type { McNode, McNetwork, PlatformUser, Role, AuditEvent } from "@/types";
export const useDataStore = create<{
  nodes: McNode[]; networks: McNetwork[]; users: PlatformUser[]; roles: Role[]; activity: AuditEvent[];
}>(() => ({ nodes: [], networks: [], users: [], roles: [], activity: [] }));
