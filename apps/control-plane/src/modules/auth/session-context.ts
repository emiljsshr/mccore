import type { PrismaClient } from "@mccore/database";
import type { SessionUserDto } from "@mccore/contracts";

export interface SessionContext extends SessionUserDto {
  /** Convenience for RBAC checks — a Set is O(1) `.has()`. */
  permissionSet: Set<string>;
}

/**
 * Computes the effective RBAC context for a user: union of permissions
 * across all assigned roles, super-admin bypass flag (§10 — checked
 * separately from any specific permission, never via a scattered
 * `role === "SUPER_ADMIN"` string check), and server visibility scope
 * (§44 — `null` means "all servers", an array means "only these").
 */
export async function loadSessionUser(prisma: PrismaClient, userId: string): Promise<SessionContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: { include: { role: { include: { permissions: true } } }, orderBy: { role: { priority: "asc" } } },
      serverAccess: { select: { serverId: true } },
      twoFactor: { select: { enabled: true } },
    },
  });
  if (!user || user.status !== "ACTIVE") return null;

  type LoadedRole = { name: string; isGlobalAccess: boolean; permissions: { permissionId: string }[] };
  const roles: LoadedRole[] = user.userRoles.map((ur: { role: LoadedRole }) => ur.role);
  const primaryRole = roles[0];
  const isGlobalAccess = roles.some((r) => r.isGlobalAccess);
  const permissions = new Set<string>();
  for (const role of roles) {
    for (const rp of role.permissions) permissions.add(rp.permissionId);
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarSeed: user.avatarSeed,
    role: (primaryRole?.name ?? "viewer") as SessionUserDto["role"],
    isSuperAdmin: user.isSuperAdmin,
    permissions: Array.from(permissions),
    permissionSet: permissions,
    serverIds: isGlobalAccess || user.isSuperAdmin ? null : user.serverAccess.map((a: { serverId: string }) => a.serverId),
    totpEnabled: user.twoFactor?.enabled ?? false,
  };
}

/** SUPER_ADMIN bypasses every specific check (§10) — this is the one
 * sanctioned place that's true; every other permission gate goes through
 * `hasPermission` below instead of re-checking `isSuperAdmin` itself. */
export function hasPermission(ctx: SessionContext, permissionId: string): boolean {
  return ctx.isSuperAdmin || ctx.permissionSet.has(permissionId);
}

export function canAccessServer(ctx: SessionContext, serverId: string): boolean {
  return ctx.isSuperAdmin || ctx.serverIds === null || ctx.serverIds.includes(serverId);
}
