/**
 * Canonical RBAC permission catalog (§43). This is the single source of
 * truth — the Prisma seed loads exactly this list into the `Permission`
 * table, the Control Plane's RBAC middleware checks against these ids, and
 * the frontend's role editor UI (`src/types/permission.ts`) re-exports this
 * list rather than keeping a second copy.
 */

export type PermissionGroup =
  | "server"
  | "console"
  | "players"
  | "files"
  | "plugins"
  | "worlds"
  | "backups"
  | "schedules"
  | "nodes"
  | "users"
  | "settings"
  | "audit"
  | "api";

export interface PermissionDef {
  id: string;
  label: string;
  description: string;
  group: PermissionGroup;
}

export const PERMISSION_GROUP_LABEL: Record<PermissionGroup, string> = {
  server: "Server",
  console: "Console",
  players: "Players",
  files: "Files",
  plugins: "Plugins",
  worlds: "Worlds",
  backups: "Backups",
  schedules: "Schedules",
  nodes: "Nodes",
  users: "Users",
  settings: "Settings",
  audit: "Audit",
  api: "API",
};

export const PERMISSIONS: PermissionDef[] = [
  { id: "server.view", label: "View servers", description: "Allow viewing server details and status.", group: "server" },
  { id: "server.create", label: "Create server", description: "Allow creating new Minecraft servers.", group: "server" },
  { id: "server.delete", label: "Delete server", description: "Allow permanently deleting a server.", group: "server" },
  { id: "server.start", label: "Start server", description: "Allow starting a stopped server.", group: "server" },
  { id: "server.stop", label: "Stop server", description: "Allow gracefully stopping a running server.", group: "server" },
  { id: "server.restart", label: "Restart server", description: "Allow restarting a running server.", group: "server" },
  { id: "server.kill", label: "Force kill server", description: "Allow force-terminating a server process.", group: "server" },

  { id: "console.view", label: "View console", description: "Allow viewing the live server console.", group: "console" },
  { id: "console.execute", label: "Execute commands", description: "Allow sending commands to the console.", group: "console" },

  { id: "players.view", label: "View players", description: "Allow viewing player lists and details.", group: "players" },
  { id: "players.kick", label: "Kick players", description: "Allow kicking connected players.", group: "players" },
  { id: "players.ban", label: "Ban players", description: "Allow banning and unbanning players.", group: "players" },
  { id: "players.op", label: "Manage operators", description: "Allow granting or revoking operator status.", group: "players" },
  { id: "players.whitelist", label: "Manage whitelist", description: "Allow adding or removing whitelist entries.", group: "players" },

  { id: "files.view", label: "View files", description: "Allow browsing the server file system.", group: "files" },
  { id: "files.write", label: "Edit files", description: "Allow editing, creating and uploading files.", group: "files" },
  { id: "files.delete", label: "Delete files", description: "Allow deleting files and folders.", group: "files" },

  { id: "plugins.view", label: "View plugins", description: "Allow viewing installed plugins.", group: "plugins" },
  { id: "plugins.install", label: "Install plugins", description: "Allow installing plugins from the marketplace.", group: "plugins" },
  { id: "plugins.update", label: "Update plugins", description: "Allow updating installed plugins.", group: "plugins" },
  { id: "plugins.delete", label: "Remove plugins", description: "Allow disabling or deleting plugins.", group: "plugins" },

  { id: "worlds.view", label: "View worlds", description: "Allow viewing world details and size.", group: "worlds" },
  { id: "worlds.manage", label: "Manage worlds", description: "Allow backing up, duplicating, resetting or deleting worlds.", group: "worlds" },

  { id: "backups.view", label: "View backups", description: "Allow viewing backup history.", group: "backups" },
  { id: "backups.create", label: "Create backups", description: "Allow creating manual backups.", group: "backups" },
  { id: "backups.restore", label: "Restore backups", description: "Allow restoring a server from a backup.", group: "backups" },
  { id: "backups.delete", label: "Delete backups", description: "Allow deleting stored backups.", group: "backups" },

  { id: "schedules.view", label: "View schedules", description: "Allow viewing scheduled tasks.", group: "schedules" },
  { id: "schedules.manage", label: "Manage schedules", description: "Allow creating, editing and deleting scheduled tasks.", group: "schedules" },

  { id: "nodes.view", label: "View nodes", description: "Allow viewing node health and metrics.", group: "nodes" },
  { id: "nodes.create", label: "Add nodes", description: "Allow generating node enrollment tokens.", group: "nodes" },
  { id: "nodes.manage", label: "Manage nodes", description: "Allow editing node configuration.", group: "nodes" },
  { id: "nodes.delete", label: "Remove nodes", description: "Allow removing a node from the platform.", group: "nodes" },

  { id: "users.view", label: "View users", description: "Allow viewing platform users and roles.", group: "users" },
  { id: "users.manage", label: "Manage users", description: "Allow inviting, editing, suspending and role-assigning users.", group: "users" },

  { id: "settings.view", label: "View settings", description: "Allow viewing platform settings.", group: "settings" },
  { id: "settings.manage", label: "Edit settings", description: "Allow changing server and platform settings.", group: "settings" },

  { id: "audit.view", label: "View audit log", description: "Allow viewing the platform audit log.", group: "audit" },

  { id: "api.manage", label: "Manage API keys", description: "Allow creating and revoking API keys.", group: "api" },
];

export const PERMISSION_IDS = PERMISSIONS.map((p) => p.id);
export type PermissionId = (typeof PERMISSION_IDS)[number];

export function isPermissionId(value: string): value is PermissionId {
  return (PERMISSION_IDS as string[]).includes(value);
}

export type RoleName = "owner" | "administrator" | "developer" | "moderator" | "viewer";

/**
 * Default permission grants for the built-in system roles. `owner` is not
 * assignable through the UI — it exists only as the SUPER_ADMIN's implicit
 * role and its check is a real bypass (`isSuperAdmin`), not membership in
 * this list, so it's included here only for display/consistency, not as a
 * gate anyone codes against (§10).
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<Exclude<RoleName, "owner">, PermissionId[]> = {
  administrator: PERMISSION_IDS as PermissionId[],
  developer: [
    "server.view", "server.start", "server.stop", "server.restart",
    "console.view", "console.execute",
    "players.view", "players.kick",
    "files.view", "files.write",
    "plugins.view", "plugins.install", "plugins.update",
    "worlds.view",
    "backups.view", "backups.create",
    "schedules.view",
    "nodes.view",
  ],
  moderator: [
    "server.view",
    "console.view", "console.execute",
    "players.view", "players.kick", "players.ban", "players.whitelist",
    "files.view",
  ],
  viewer: [
    "server.view",
    "console.view",
    "players.view",
    "files.view",
    "plugins.view",
    "worlds.view",
    "backups.view",
    "schedules.view",
    "nodes.view",
  ],
};

export const ROLE_LABEL: Record<RoleName, string> = {
  owner: "Owner",
  administrator: "Administrator",
  developer: "Developer",
  moderator: "Moderator",
  viewer: "Viewer",
};
