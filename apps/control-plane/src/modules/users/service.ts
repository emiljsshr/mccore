import type { PrismaClient, User as UserRow, Role as RoleRow } from "@mccore/database";
import type { PlatformUserDto, RoleName } from "@mccore/contracts";

/**
 * §44: a user's "primary" role is the one with the lowest `Role.priority`
 * among their assigned roles (lower = more privileged) — mirrors
 * `session-context.ts#loadSessionUser`, which orders the same relation the
 * same way. Falls back to "viewer" for the (should-never-happen) case of a
 * user with zero role assignments, matching the session-context fallback.
 */
const FALLBACK_ROLE: RoleName = "viewer";

export const USER_WITH_ACCESS_INCLUDE = {
  userRoles: { include: { role: true }, orderBy: { role: { priority: "asc" as const } } },
  serverAccess: { select: { serverId: true } },
} as const;

export type UserWithAccess = UserRow & {
  userRoles: { role: RoleRow }[];
  serverAccess: { serverId: string }[];
};

export function toPlatformUserDto(user: UserWithAccess): PlatformUserDto {
  const primaryRole = user.userRoles[0]?.role;
  const roleName = (primaryRole?.name ?? FALLBACK_ROLE) as RoleName;
  // §44: `serverIds` is only meaningful for non-global-access roles — a
  // global-access user (e.g. administrator) is always shown as having
  // access to every server, represented here as an empty scoping list.
  const serverIds = primaryRole?.isGlobalAccess ? [] : user.serverAccess.map((a: { serverId: string }) => a.serverId);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarSeed: user.avatarSeed,
    role: roleName,
    serverIds,
    lastActive: (user.lastActiveAt ?? user.createdAt).toISOString(),
    status: user.status.toLowerCase() as PlatformUserDto["status"],
    createdAt: user.createdAt.toISOString(),
  };
}

export async function listUsers(prisma: PrismaClient): Promise<PlatformUserDto[]> {
  const users = await prisma.user.findMany({ include: USER_WITH_ACCESS_INCLUDE, orderBy: { createdAt: "asc" } });
  return users.map(toPlatformUserDto);
}

export async function getUserWithAccess(prisma: PrismaClient, id: string): Promise<UserWithAccess | null> {
  return prisma.user.findUnique({ where: { id }, include: USER_WITH_ACCESS_INCLUDE });
}

/**
 * True if `userId` holds the "owner" role and is the *only* user who does —
 * used to keep the platform-invariant "there is always at least one owner"
 * intact across both role changes and account deletion.
 */
export async function isLastOwner(prisma: PrismaClient, userId: string): Promise<boolean> {
  const ownerRole = await prisma.role.findUnique({ where: { name: "owner" } });
  if (!ownerRole) return false;
  const membership = await prisma.userRole.findUnique({
    where: { userId_roleId: { userId, roleId: ownerRole.id } },
  });
  if (!membership) return false;
  const ownerCount = await prisma.userRole.count({ where: { roleId: ownerRole.id } });
  return ownerCount <= 1;
}
