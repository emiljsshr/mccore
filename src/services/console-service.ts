import type { ConsoleLine } from "@/types";
import { api, mutation } from "@/lib/api";
import { subscribeLive } from "@/lib/live";
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
  return { id: crypto.randomUUID(), timestamp: new Date().toISOString(), level: "COMMAND", message: command };
}
