import type { Player, PlayerInventory } from "@/types";
import { api, mutation } from "@/lib/api";
import { usePlayerStore } from "@/stores/use-player-store";
export async function listPlayers(): Promise<Player[]> { const { players } = await api<{ players: Player[] }>("/players"); usePlayerStore.setState({ players }); return players; }
export async function getPlayer(id: string): Promise<Player | undefined> { return (await listPlayers()).find(p => p.id === id || p.uuid === id); }
function player(id: string) { const p = usePlayerStore.getState().players.find(p => p.id === id || p.uuid === id); if (!p?.serverId) throw new Error("Select a server for this player action."); return p; }
async function act(id: string, action: string, body: object = {}) { const p = player(id); await api(`/servers/${p.serverId}/players/${p.uuid}/${action}`, mutation("POST", body)); await listPlayers(); }
export const kickPlayer = (id: string) => act(id, "kick");
export const messagePlayer = (id: string, message: string) => act(id, "message", { message });
export const banPlayer = (id: string, reason: string, _bannedBy: string) => act(id, "ban", { reason });
export const unbanPlayer = (id: string) => act(id, "pardon");
export const toggleOperator = (id: string) => act(id, "op", { action: player(id).operator ? "deop" : "op" });
export const toggleWhitelist = (id: string) => act(id, "whitelist", { action: player(id).whitelisted ? "remove" : "add" });
/** Live snapshot via the mcCore Bridge plugin — not cached, since inventory contents change too fast to trust an old one. */
export async function getPlayerInventory(id: string): Promise<PlayerInventory> {
  const p = player(id);
  const { inventory } = await api<{ inventory: PlayerInventory }>(`/servers/${p.serverId}/players/${p.uuid}/invsee`, mutation("POST"));
  return inventory;
}
export async function setGameMode(id: string, gameMode: Player["gameMode"]) {
  const p = player(id);
  if (!/^[A-Za-z0-9_]{3,16}$/.test(p.username) || !["survival", "creative", "adventure", "spectator"].includes(gameMode)) throw new Error("Invalid game mode or username.");
  await api(`/servers/${p.serverId}/console/command`, mutation("POST", { command: `gamemode ${gameMode} ${p.username}` }));
}
