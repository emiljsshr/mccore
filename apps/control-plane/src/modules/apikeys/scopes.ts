export const scopePermissions: Record<string, string[]> = {
  "server:read": ["server.view", "console.view"],
  "server:write": ["server.create", "server.delete", "server.start", "server.stop", "server.restart", "server.kill", "console.execute"],
  "players:read": ["players.view"],
  "players:write": ["players.kick", "players.ban", "players.op", "players.whitelist"],
  "files:read": ["files.view"], "files:write": ["files.write", "files.delete"],
  "nodes:read": ["nodes.view"], "nodes:write": ["nodes.create", "nodes.manage", "nodes.delete"],
  "backups:read": ["backups.view"], "backups:write": ["backups.create", "backups.restore", "backups.delete"],
};
