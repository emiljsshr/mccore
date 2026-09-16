export type PluginStatus = "enabled" | "disabled" | "error";

export type PluginCategory =
  | "administration"
  | "world-management"
  | "economy"
  | "permissions"
  | "performance"
  | "chat"
  | "protection"
  | "utility";

export interface InstalledPlugin {
  providerSlug?: string;
  providerProjectId?: string;
  id: string;
  serverId: string;
  name: string;
  version: string;
  latestVersion?: string;
  author: string;
  description: string;
  status: PluginStatus;
  category: PluginCategory;
  updateAvailable: boolean;
  iconLetter: string;
  fileSizeMb: number;
  installedAt: string;
}

export interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  author: string;
  category: PluginCategory;
  downloads: number;
  rating: number;
  supportedVersions: string[];
  iconLetter: string;
  verified: boolean;
}

export const PLUGIN_CATEGORY_LABEL: Record<PluginCategory, string> = {
  administration: "Administration",
  "world-management": "World Management",
  economy: "Economy",
  permissions: "Permissions",
  performance: "Performance",
  chat: "Chat",
  protection: "Protection",
  utility: "Utility",
};
