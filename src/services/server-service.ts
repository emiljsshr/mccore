import type { Server } from "@/types";
import type { CreateServerInput as Input } from "@mccore/contracts";
import { api, mutation } from "@/lib/api";
import { useServerStore } from "@/stores/use-server-store";

export type CreateServerInput = Input;
export const CREATE_SERVER_STEPS = ["Preparing server", "Downloading software", "Verifying download", "Generating configuration", "Ready"] as const;
export async function listServers(): Promise<Server[]> {
  const { servers } = await api<{ servers: Server[] }>("/servers");
  useServerStore.setState({ servers }); return servers;
}
export async function getServer(id: string): Promise<Server> {
  const { server } = await api<{ server: Server }>(`/servers/${id}`);
  useServerStore.getState().patchServer(id, server); return server;
}
async function control(id: string, action: string) {
  await api(`/servers/${id}/${action}`, mutation("POST"));
  await getServer(id);
}
export const startServer = (id: string) => control(id, "start");
export const stopServer = (id: string) => control(id, "stop");
export const restartServer = (id: string) => control(id, "restart");
export const killServer = (id: string) => control(id, "kill");
export async function deleteServer(id: string) {
  await api(`/servers/${id}`, mutation("DELETE")); useServerStore.getState().removeServer(id);
}
export async function duplicateServer(_id: string): Promise<Server | undefined> {
  throw new Error("Create a new server and restore a backup to duplicate its data.");
}
export async function createServer(input: CreateServerInput, onProgress?: (index: number, step: string) => void): Promise<Server> {
  const { server } = await api<{ server: Server }>("/servers", mutation("POST", input, true));
  useServerStore.getState().addServer(server);
  onProgress?.(0, CREATE_SERVER_STEPS[0]);
  // Installation continues on the node. Its status is shown on the server page.
  return server;
}
