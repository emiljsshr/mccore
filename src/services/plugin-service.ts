import type { InstalledPlugin, MarketplacePlugin } from "@/types";
import { api, mutation } from "@/lib/api";
import { usePluginStore } from "@/stores/use-plugin-store";
import { useServerStore } from "@/stores/use-server-store";
import { waitForOperation } from "./operation-service";
import type { OperationDto } from "@mccore/contracts";
export async function listInstalledPlugins(serverId?: string): Promise<InstalledPlugin[]> {
  const ids = serverId ? [serverId] : useServerStore.getState().servers.map(s => s.id);
  const groups = await Promise.all(ids.map(id => api<{ plugins: InstalledPlugin[] }>(`/servers/${id}/plugins`)));
  const plugins = groups.flatMap(g => g.plugins);
  usePluginStore.setState(s => ({ plugins: [...s.plugins.filter(p => !ids.includes(p.serverId)), ...plugins] })); return plugins;
}
export async function listMarketplacePlugins(): Promise<MarketplacePlugin[]> {
  const { searchModrinth } = await import("./modrinth-service");
  const result = await searchModrinth({ query: "", projectType: "plugin" });
  return result.hits.map(hit => ({ id: hit.project_id, name: hit.title, description: hit.description, author: hit.author, category: "utility", downloads: hit.downloads, rating: 0, supportedVersions: hit.versions, iconLetter: hit.title[0], verified: false }));
}
function plugin(id: string) { const p = usePluginStore.getState().plugins.find(p => p.id === id); if (!p) throw new Error("Plugin not found."); return p; }
export async function setPluginStatus(id: string, status: InstalledPlugin["status"]) { const p = plugin(id); await api(`/servers/${p.serverId}/plugins/${id}/status`, mutation("PATCH", { status })); await listInstalledPlugins(p.serverId); }
export async function deletePlugin(id: string) { const p = plugin(id); await api(`/servers/${p.serverId}/plugins/${id}`, mutation("DELETE")); usePluginStore.getState().removePlugin(id); }
export async function updatePlugin(id: string) { const p = plugin(id); const { operation } = await api<{ operation: OperationDto }>(`/servers/${p.serverId}/plugins/${id}/update`, mutation("POST", { providerSlug: p.providerSlug, providerProjectId: p.providerProjectId }, true)); await waitForOperation(operation.id); await listInstalledPlugins(p.serverId); }
export const INSTALL_PLUGIN_STEPS = ["Downloading", "Installing", "Installed"] as const;
export async function installPlugin(plugin: MarketplacePlugin, serverId: string, onProgress?: (index: number, step: string) => void): Promise<InstalledPlugin> {
  const { operation } = await api<{ operation: OperationDto }>(`/servers/${serverId}/plugins/install`, mutation("POST", { providerSlug: "modrinth", providerProjectId: plugin.id }, true));
  await waitForOperation(operation.id, op => { const i = op.status === "SUCCEEDED" ? 2 : op.progress < 75 ? 0 : 1; onProgress?.(i, INSTALL_PLUGIN_STEPS[i]); });
  const installed = (await listInstalledPlugins(serverId)).find(p => p.providerProjectId === plugin.id);
  if (!installed) throw new Error("Installation completed, but plugin metadata could not be loaded. Refresh the page.");
  return installed;
}
