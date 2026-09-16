import type { MinecraftSoftware, ModrinthSearchHit, PluginCategory, Server } from "@/types";
import { SERVER_SOFTWARE_LABEL } from "@/types";

export type CompatLevel = "compatible" | "version-mismatch" | "incompatible";

export interface CompatibilityResult {
  level: CompatLevel;
  reason: string;
}

/** Modrinth loader/platform tags that can run on each of our server software types. */
const SOFTWARE_LOADERS: Record<MinecraftSoftware, string[]> = {
  paper: ["paper", "purpur", "spigot", "bukkit", "folia"],
  purpur: ["purpur", "paper", "spigot", "bukkit", "folia"],
  vanilla: ["datapack"],
  fabric: ["fabric", "quilt"],
  forge: ["forge"],
  neoforge: ["neoforge"],
  velocity: ["velocity", "bungeecord", "waterfall"],
};

const LOADER_LABEL: Record<string, string> = {
  paper: "Paper",
  purpur: "Purpur",
  spigot: "Spigot",
  bukkit: "Bukkit",
  folia: "Folia",
  fabric: "Fabric",
  quilt: "Quilt",
  forge: "Forge",
  neoforge: "NeoForge",
  velocity: "Velocity",
  bungeecord: "BungeeCord",
  waterfall: "Waterfall",
  datapack: "Data Pack",
};

function listSupportedLoaders(categories: string[]): string {
  const known = Array.from(new Set(categories.map((c) => LOADER_LABEL[c]).filter((v): v is string => Boolean(v))));
  return known.length > 0 ? known.join(", ") : "no compatible platform";
}

/**
 * Checks whether a Modrinth project can run on a given server, based on the
 * server's software (loader) and Minecraft version. This is a client-side
 * heuristic over the search hit's `categories`/`versions` tags — good enough
 * to warn about obvious mismatches (e.g. a Fabric-only mod on a Paper server)
 * without a second round-trip per project.
 */
export function checkCompatibility(hit: ModrinthSearchHit, server: Server): CompatibilityResult {
  const loaders = SOFTWARE_LOADERS[server.software];
  const loaderMatch = hit.categories.some((c) => loaders.includes(c));

  if (!loaderMatch) {
    return {
      level: "incompatible",
      reason: `Not built for ${SERVER_SOFTWARE_LABEL[server.software]} — supports ${listSupportedLoaders(hit.categories)}`,
    };
  }

  // Velocity proxies aren't tied to a single Minecraft version the way a
  // backend server is, so loader compatibility alone is decisive.
  if (server.software === "velocity") {
    return { level: "compatible", reason: "Compatible with this proxy" };
  }

  const [major, minor] = server.minecraftVersion.split(".");
  const prefix = `${major}.${minor}`;
  const versionMatch = hit.versions.some((v) => v === server.minecraftVersion || v.startsWith(`${prefix}.`) || v === prefix);

  if (!versionMatch) {
    const newest = hit.versions[hit.versions.length - 1];
    return {
      level: "version-mismatch",
      reason: `No release listed for Minecraft ${server.minecraftVersion}${newest ? ` (newest supported: ${newest})` : ""}`,
    };
  }

  return { level: "compatible", reason: "Compatible with this server" };
}

const CATEGORY_KEYWORDS: [string, PluginCategory][] = [
  ["economy", "economy"],
  ["management", "administration"],
  ["social", "chat"],
  ["chat", "chat"],
  ["protection", "protection"],
  ["optimization", "performance"],
  ["performance", "performance"],
  ["world-generation", "world-management"],
  ["minigame", "world-management"],
];

/** Best-effort mapping from Modrinth's tag taxonomy to our local plugin categories, for display only. */
export function mapModrinthCategory(categories: string[]): PluginCategory {
  for (const [needle, category] of CATEGORY_KEYWORDS) {
    if (categories.includes(needle)) return category;
  }
  return "utility";
}
