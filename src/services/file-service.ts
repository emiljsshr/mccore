import type { FileEntry } from "@/types";
import { api, mutation } from "@/lib/api";
const relative = (path: string) => path.replace(/^\/+/, "");
export async function listFiles(serverId: string, path: string): Promise<FileEntry[]> {
  return (await api<{ entries: FileEntry[] }>(`/servers/${serverId}/files?path=${encodeURIComponent(relative(path))}`)).entries;
}
export async function readFile(serverId: string, path: string): Promise<string> {
  const { contentBase64 } = await api<{ contentBase64: string }>(`/servers/${serverId}/files/content?path=${encodeURIComponent(relative(path))}`);
  return new TextDecoder().decode(Uint8Array.from(atob(contentBase64), c => c.charCodeAt(0)));
}
export async function saveFile(serverId: string, path: string, content: string) {
  const bytes = new TextEncoder().encode(content); let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  await api(`/servers/${serverId}/files/content`, mutation("PUT", { path: relative(path), contentBase64: btoa(binary) }));
}
export async function deleteFile(serverId: string, path: string) { await api(`/servers/${serverId}/files`, mutation("DELETE", { path: relative(path) })); }
