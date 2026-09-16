import type { InstalledPlugin, ModrinthProjectTypeFilter, ModrinthSearchHit, ModrinthSearchResponse } from "@/types";

import { mapModrinthCategory } from "@/lib/modrinth-compat";


interface SearchModrinthParams {
  query: string;
  projectType: ModrinthProjectTypeFilter;
  limit?: number;
  offset?: number;
}

export async function searchModrinth({
  query,
  projectType,
  limit = 20,
  offset = 0,
}: SearchModrinthParams): Promise<ModrinthSearchResponse> {
  const params = new URLSearchParams({
    query,
    projectType,
    limit: String(limit),
    offset: String(offset),
    index: query.trim() ? "relevance" : "downloads",
  });
  const res = await fetch(`/api/modrinth/search?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Modrinth search failed (${res.status})`);
  }
  return res.json();
}

export const INSTALL_MODRINTH_STEPS = ["Fetching from Modrinth", "Downloading", "Installing", "Installed"] as const;

export async function installModrinthProject(
  hit: ModrinthSearchHit,
  serverId: string,
  onProgress?: (stepIndex: number, step: string) => void,
): Promise<InstalledPlugin> {
  const { installPlugin } = await import("./plugin-service");
  return installPlugin({ id: hit.project_id, name: hit.title, description: hit.description, author: hit.author, category: mapModrinthCategory(hit.categories), downloads: hit.downloads, rating: 0, supportedVersions: hit.versions, iconLetter: hit.title[0], verified: false }, serverId, onProgress);
}
