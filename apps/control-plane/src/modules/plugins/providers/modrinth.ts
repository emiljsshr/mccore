import { ApiError, ErrorCode } from "@mccore/contracts";
import type { PluginProvider, PluginSearchResult, PluginVersionInfo } from "./types.js";

const MODRINTH_API = "https://api.modrinth.com/v2";
const USER_AGENT = "mcCore/0.1 (+https://github.com/cometa-mccore/mccore)";
const FETCH_TIMEOUT_MS = 10_000;
const PROJECT_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * §35/§67: the only network calls this file makes are to the fixed
 * `api.modrinth.com` host — `projectId`/`versionId` are validated against
 * a strict allowlist regex before ever being interpolated into a URL, so
 * there is no path for user input to redirect this fetch anywhere else
 * (no SSRF surface).
 */
async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: controller.signal });
    if (!res.ok) {
      throw new ApiError(ErrorCode.DOWNLOAD_FAILED, `Modrinth API responded with ${res.status}.`);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(ErrorCode.DOWNLOAD_FAILED, `Could not reach Modrinth: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }
}

function assertValidProjectId(id: string) {
  if (!PROJECT_ID_RE.test(id)) throw new ApiError(ErrorCode.VALIDATION_ERROR, "Invalid Modrinth project id.");
}

interface ModrinthSearchHit {
  project_id: string;
  title: string;
  description: string;
  author: string;
  categories: string[];
  downloads: number;
  follows: number;
  icon_url: string | null;
  versions: string[];
}

interface ModrinthVersion {
  id: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  files: Array<{ filename: string; url: string; primary: boolean; size: number; hashes: { sha512?: string; sha1?: string } }>;
}

interface ModrinthProject {
  id: string;
  title: string;
  description: string;
  categories: string[];
  downloads: number;
  followers: number;
  icon_url: string | null;
  game_versions: string[];
  team: string;
}

function toSearchResult(hit: ModrinthSearchHit): PluginSearchResult {
  return {
    providerSlug: "modrinth",
    providerProjectId: hit.project_id,
    name: hit.title,
    description: hit.description,
    author: hit.author,
    category: hit.categories[0] ?? "utility",
    downloads: hit.downloads,
    rating: 0, // Modrinth has no numeric rating; downloads/follows stand in for it in the UI
    supportedVersions: hit.versions,
    iconUrl: hit.icon_url ?? undefined,
    verified: true,
  };
}

export const modrinthProvider: PluginProvider = {
  slug: "modrinth",

  async search(query, opts) {
    const url = new URL(`${MODRINTH_API}/search`);
    url.searchParams.set("query", query);
    url.searchParams.set("limit", "20");
    const facets: string[][] = [["project_type:plugin"]];
    if (opts?.minecraftVersion) facets.push([`versions:${opts.minecraftVersion}`]);
    if (opts?.category) facets.push([`categories:${opts.category}`]);
    url.searchParams.set("facets", JSON.stringify(facets));
    const data = (await fetchJson(url.toString())) as { hits: ModrinthSearchHit[] };
    return data.hits.map(toSearchResult);
  },

  async getProject(projectId) {
    assertValidProjectId(projectId);
    try {
      const project = (await fetchJson(`${MODRINTH_API}/project/${projectId}`)) as ModrinthProject;
      return {
        providerSlug: "modrinth",
        providerProjectId: project.id,
        name: project.title,
        description: project.description,
        author: project.team,
        category: project.categories[0] ?? "utility",
        downloads: project.downloads,
        rating: 0,
        supportedVersions: project.game_versions,
        iconUrl: project.icon_url ?? undefined,
        verified: true,
      };
    } catch (err) {
      if (err instanceof ApiError && err.code === ErrorCode.DOWNLOAD_FAILED) return null;
      throw err;
    }
  },

  async getVersions(projectId, opts): Promise<PluginVersionInfo[]> {
    assertValidProjectId(projectId);
    const url = new URL(`${MODRINTH_API}/project/${projectId}/version`);
    if (opts?.minecraftVersion) url.searchParams.set("game_versions", JSON.stringify([opts.minecraftVersion]));
    if (opts?.loader) url.searchParams.set("loaders", JSON.stringify([opts.loader]));
    const versions = (await fetchJson(url.toString())) as ModrinthVersion[];
    return versions
      .map((v): PluginVersionInfo | null => {
        const primary = v.files.find((f) => f.primary) ?? v.files[0];
        if (!primary) return null;
        return {
          versionId: v.id,
          versionNumber: v.version_number,
          gameVersions: v.game_versions,
          loaders: v.loaders,
          primaryFile: {
            fileName: primary.filename,
            downloadUrl: primary.url,
            sha512: primary.hashes.sha512,
            sha1: primary.hashes.sha1,
            sizeBytes: primary.size,
          },
        };
      })
      .filter((v): v is PluginVersionInfo => v !== null);
  },
};

export function getPluginProvider(slug: string): PluginProvider {
  if (slug === "modrinth") return modrinthProvider;
  throw new ApiError(ErrorCode.VALIDATION_ERROR, `Unknown plugin provider: ${slug}`);
}
