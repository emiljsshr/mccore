import type { ConsoleLine } from "@/types";
import { api, mutation } from "@/lib/api";
import { subscribeLive } from "@/lib/live";
import { ulid } from "@mccore/contracts";
export async function getConsoleHistory(serverId: string): Promise<ConsoleLine[]> {
  return (await api<{ lines: ConsoleLine[] }>(`/servers/${serverId}/console`)).lines;
}
export function subscribeToConsole(serverId: string, onLine: (line: ConsoleLine) => void): () => void {
  return subscribeLive(`server:${serverId}`, event => {
    if (event.type === "server.console") for (const line of (event.payload as { lines: ConsoleLine[] }).lines) onLine(line);
  });
}
export async function sendCommand(serverId: string, command: string): Promise<ConsoleLine> {
  await api(`/servers/${serverId}/console/command`, mutation("POST", { command }));
  // Not crypto.randomUUID(): undefined outside secure contexts (HTTPS/localhost).
  return { id: ulid(), timestamp: new Date().toISOString(), level: "COMMAND", message: command };
}
/** Broadcasts a chat message server-wide via the mcCore Bridge plugin (see ChatListener/BroadcastCommand). */
export async function sendChatMessage(serverId: string, message: string): Promise<void> {
  await api(`/servers/${serverId}/chat`, mutation("POST", { message }));
}
