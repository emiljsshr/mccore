import type { InstalledPlugin, ModrinthProjectTypeFilter, ModrinthSearchHit, ModrinthSearchResponse } from "@/types";


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
  force = false,
): Promise<InstalledPlugin> {
  const { installPlugin } = await import("./plugin-service");
  return installPlugin(hit.project_id, serverId, onProgress, force);
}
