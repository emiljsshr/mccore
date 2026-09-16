export type RoleName =
  | "owner"
  | "administrator"
  | "developer"
  | "moderator"
  | "viewer";

export interface Permission {
  id: string;
  label: string;
  description: string;
  group: PermissionGroup;
}

export type PermissionGroup =
  | "server"
  | "console"
  | "players"
  | "files"
  | "plugins"
  | "backups"
  | "settings";

export interface Role {
  id: string;
  name: RoleName;
  label: string;
  description: string;
  isSystem: boolean;
  permissionIds: string[];
  memberCount: number;
}

export const PERMISSION_GROUP_LABEL: Record<PermissionGroup, string> = {
  server: "Server",
  console: "Console",
  players: "Players",
  files: "Files",
  plugins: "Plugins",
  backups: "Backups",
  settings: "Settings",
};

export const PERMISSIONS: Permission[] = [
  { id: "server.start", label: "Start server", description: "Allow starting a stopped server.", group: "server" },
  { id: "server.stop", label: "Stop server", description: "Allow gracefully stopping a running server.", group: "server" },
  { id: "server.restart", label: "Restart server", description: "Allow restarting a running server.", group: "server" },
  { id: "server.kill", label: "Force kill server", description: "Allow force-terminating a server process.", group: "server" },
  { id: "server.create", label: "Create server", description: "Allow creating new Minecraft servers.", group: "server" },
  { id: "server.delete", label: "Delete server", description: "Allow permanently deleting a server.", group: "server" },
  { id: "console.view", label: "View console", description: "Allow viewing the live server console.", group: "console" },
  { id: "console.execute", label: "Execute commands", description: "Allow sending commands to the console.", group: "console" },
  { id: "players.view", label: "View players", description: "Allow viewing player lists and details.", group: "players" },
  { id: "players.kick", label: "Kick players", description: "Allow kicking connected players.", group: "players" },
  { id: "players.ban", label: "Ban players", description: "Allow banning and unbanning players.", group: "players" },
  { id: "players.op", label: "Manage operators", description: "Allow granting or revoking operator status.", group: "players" },
  { id: "files.view", label: "View files", description: "Allow browsing the server file system.", group: "files" },
  { id: "files.edit", label: "Edit files", description: "Allow editing and uploading files.", group: "files" },
  { id: "files.delete", label: "Delete files", description: "Allow deleting files and folders.", group: "files" },
  { id: "plugins.install", label: "Install plugins", description: "Allow installing plugins from the marketplace.", group: "plugins" },
  { id: "plugins.delete", label: "Remove plugins", description: "Allow disabling or deleting plugins.", group: "plugins" },
  { id: "backups.create", label: "Create backups", description: "Allow creating manual backups.", group: "backups" },
  { id: "backups.restore", label: "Restore backups", description: "Allow restoring a server from a backup.", group: "backups" },
  { id: "settings.edit", label: "Edit settings", description: "Allow changing server and platform settings.", group: "settings" },
];
