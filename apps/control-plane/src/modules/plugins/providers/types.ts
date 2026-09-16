/**
 * §35: plugin sources are abstracted behind this interface so a second
 * provider (Hangar, etc.) is an additive implementation, not a rewrite.
 * Every method talks to a fixed, hardcoded provider host — implementations
 * must never accept a caller-supplied base URL (that would reopen the SSRF
 * hole this abstraction exists partly to close, see §67).
 */
export interface PluginSearchResult {
  providerSlug: string;
  providerProjectId: string;
  name: string;
  description: string;
  author: string;
  category: string;
  downloads: number;
  rating: number;
  supportedVersions: string[];
  iconUrl?: string;
  verified: boolean;
}

export interface PluginVersionFile {
  fileName: string;
  downloadUrl: string;
  sha512?: string;
  sha1?: string;
  sizeBytes: number;
}

export interface PluginVersionInfo {
  versionId: string;
  versionNumber: string;
  gameVersions: string[];
  loaders: string[];
  primaryFile: PluginVersionFile;
}

export interface PluginProvider {
  slug: string;
  search(query: string, opts?: { category?: string; minecraftVersion?: string }): Promise<PluginSearchResult[]>;
  getVersions(projectId: string, opts?: { minecraftVersion?: string; loader?: string }): Promise<PluginVersionInfo[]>;
  getProject(projectId: string): Promise<PluginSearchResult | null>;
}
