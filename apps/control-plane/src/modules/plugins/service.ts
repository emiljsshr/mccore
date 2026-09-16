import type { InstalledPlugin } from "@mccore/database";
import type { InstalledPluginDto } from "@mccore/contracts";

export function toInstalledPluginDto(plugin: InstalledPlugin): InstalledPluginDto {
  return {
    id: plugin.id,
    serverId: plugin.serverId,
    name: plugin.name,
    version: plugin.version,
    latestVersion: plugin.latestVersion ?? undefined,
    author: plugin.author,
    description: plugin.description,
    status: plugin.status.toLowerCase() as InstalledPluginDto["status"],
    category: plugin.category as InstalledPluginDto["category"],
    updateAvailable: Boolean(plugin.latestVersion && plugin.latestVersion !== plugin.version),
    iconLetter: plugin.name.charAt(0).toUpperCase(),
    fileSizeMb: plugin.fileSizeMb,
    installedAt: plugin.installedAt.toISOString(),
    providerSlug: plugin.providerSlug ?? undefined,
    providerProjectId: plugin.providerProjectId ?? undefined,
  };
}
