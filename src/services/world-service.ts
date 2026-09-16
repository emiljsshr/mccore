import type { World } from "@/types";
import { api, mutation } from "@/lib/api";
import { createBackup } from "./backup-service";
const worlds = new Map<string, World>();
export async function listWorlds(serverId: string): Promise<World[]> { const data = await api<{ worlds: World[] }>(`/servers/${serverId}/worlds`); for (const w of data.worlds) worlds.set(w.id, w); return data.worlds; }
function world(id: string) { const w = worlds.get(id); if (!w) throw new Error("World not found. Reload its server page."); return w; }
export async function backupWorld(id: string) { const w = world(id); await createBackup({ serverId: w.serverId, name: `${w.name} backup`, includeWorlds: true, includePlugins: false, includeConfig: true, compression: "fast" }); }
export async function resetWorld(id: string) { const w = world(id); await api(`/servers/${w.serverId}/worlds/${id}/reset`, mutation("POST")); }
export async function deleteWorld(id: string) { const w = world(id); await api(`/servers/${w.serverId}/worlds/${id}`, mutation("DELETE")); worlds.delete(id); }
export interface CreateWorldInput { serverId: string; name: string; seed?: string; environment: World["environment"]; generator: World["generator"]; gameMode: World["gameMode"]; difficulty: World["difficulty"]; structures: boolean; hardcore: boolean; }
export async function createWorld(input: CreateWorldInput): Promise<World> { return (await api<{ world: World }>(`/servers/${input.serverId}/worlds`, mutation("POST", input))).world; }
