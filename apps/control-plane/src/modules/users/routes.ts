import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ApiError, ErrorCode, ulid, RoleNameSchema, isPermissionId } from "@mccore/contracts";
import type { Prisma, Role as RoleRow, RolePermission as RolePermissionRow } from "@mccore/database";
import { toPlatformUserDto, listUsers, getUserWithAccess, isLastOwner } from "./service.js";
import { recordAudit } from "../audit/service.js";
import { hashPassword } from "../auth/password.js";
import { revokeAllUserSessions } from "../auth/service.js";
import { randomToken, sha256Hex } from "../../lib/tokens.js";

const CreateUserSchema = z.object({
  name: z.string().trim().min(1).max(96),
  email: z.string().trim().toLowerCase().email(),
  role: RoleNameSchema,
  serverIds: z.array(z.string()).optional(),
});

const UpdateUserSchema = z.object({
  name: z.string().trim().min(1).max(96).optional(),
  role: RoleNameSchema.optional(),
  status: z.enum(["active", "suspended"]).optional(),
  serverIds: z.array(z.string()).optional(),
});

const UpdateRolePermissionsSchema = z.object({
  permissionIds: z.array(z.string()).max(200),
});

/** Shape consumed by the frontend's role editor (`src/types/permission.ts`
 * `Role`). Not a `packages/contracts` DTO — there's no wire schema for it
 * there yet, and adding one isn't necessary for this locally-typed response. */
interface RoleResponseDto {
  id: string;
  name: string;
  label: string;
  description: string;
  isSystem: boolean;
  permissionIds: string[];
  memberCount: number;
}

async function requireServersExist(app: FastifyInstance, serverIds: string[]) {
  if (serverIds.length === 0) return;
  const count = await app.prisma.minecraftServer.count({ where: { id: { in: serverIds }, deletedAt: null } });
  if (count !== serverIds.length) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, "One or more server ids do not exist.");
  }
}

export default async function usersRoutes(app: FastifyInstance) {
  app.get("/api/v1/users", { preHandler: app.requirePermission("users.view") }, async () => {
    return { users: await listUsers(app.prisma) };
  });

  app.get("/api/v1/users/:id", { preHandler: app.requirePermission("users.view") }, async (request) => {
    const { id } = request.params as { id: string };
    const user = await getUserWithAccess(app.prisma, id);
    if (!user) throw new ApiError(ErrorCode.NOT_FOUND, "User not found.");
    return { user: toPlatformUserDto(user) };
  });

  // §43: invites a user with no password set — there's no mail server, so
  // the account is created with an unguessable placeholder password hash
  // (never handed to anyone) and a `PasswordResetToken` is minted in the
  // same transaction, mirroring the auth module's password-reset-request
  // flow. The raw claim token is returned once so an operator can build a
  // manual setup link for the invitee.
  app.post("/api/v1/users", { preHandler: app.requirePermission("users.manage") }, async (request) => {
    const input = CreateUserSchema.parse(request.body);
    if (input.role === "owner") {
      throw new ApiError(ErrorCode.FORBIDDEN, "The owner role can only be assigned during initial setup.");
    }

    const existing = await app.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ApiError(ErrorCode.CONFLICT, "A user with this email already exists.");

    const role = await app.prisma.role.findUnique({ where: { name: input.role } });
    if (!role) throw new ApiError(ErrorCode.INTERNAL_ERROR, `Role "${input.role}" is not seeded.`);

    const serverIds = role.isGlobalAccess ? [] : Array.from(new Set(input.serverIds ?? []));
    await requireServersExist(app, serverIds);

    const userId = ulid();
    const placeholderPasswordHash = await hashPassword(randomToken(32));
    const claimToken = randomToken(32);

    const created = await app.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
        data: {
          id: userId,
          name: input.name,
          email: input.email,
          passwordHash: placeholderPasswordHash,
          avatarSeed: userId,
          status: "INVITED",
        },
      });
      await tx.userRole.create({ data: { userId, roleId: role.id } });
      if (serverIds.length > 0) {
        await tx.userServerAccess.createMany({
          data: serverIds.map((serverId) => ({ id: ulid(), userId, serverId })),
        });
      }
      await tx.passwordResetToken.create({
        data: {
          id: ulid(),
          userId,
          tokenHash: sha256Hex(claimToken),
          expiresAt: new Date(Date.now() + app.config.passwordResetTtlMs),
        },
      });
      return user;
    });

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "user.invited",
      description: `${request.user!.name} invited ${created.name} (${created.email}) as ${role.label}.`,
      targetType: "user",
      targetLabel: created.name,
      resourceId: created.id,
      severity: "SUCCESS",
      ipAddress: request.ip,
    });

    const withAccess = await getUserWithAccess(app.prisma, created.id);
    return { user: toPlatformUserDto(withAccess!), claimToken };
  });

  app.patch("/api/v1/users/:id", { preHandler: app.requirePermission("users.manage") }, async (request) => {
    const { id } = request.params as { id: string };
    const input = UpdateUserSchema.parse(request.body);

    if (id === request.user!.id && (input.role !== undefined || input.status !== undefined)) {
      throw new ApiError(ErrorCode.FORBIDDEN, "Cannot modify your own account role or status.");
    }

    const target = await getUserWithAccess(app.prisma, id);
    if (!target) throw new ApiError(ErrorCode.NOT_FOUND, "User not found.");

    let targetRoleId: string | undefined;
    if (input.role !== undefined) {
      if (input.role === "owner") {
        throw new ApiError(ErrorCode.FORBIDDEN, "The owner role can only be assigned during initial setup.");
      }
      const currentlyOwner = target.userRoles[0]?.role.name === "owner";
      if (currentlyOwner && (await isLastOwner(app.prisma, id))) {
        throw new ApiError(ErrorCode.CONFLICT, "Cannot change the role of the last remaining owner.");
      }
      const role = await app.prisma.role.findUnique({ where: { name: input.role } });
      if (!role) throw new ApiError(ErrorCode.INTERNAL_ERROR, `Role "${input.role}" is not seeded.`);
      targetRoleId = role.id;
    }

    const serverIds = input.serverIds !== undefined ? Array.from(new Set(input.serverIds)) : undefined;
    if (serverIds !== undefined) {
      await requireServersExist(app, serverIds);
    }

    await app.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (input.name !== undefined) {
        await tx.user.update({ where: { id }, data: { name: input.name } });
      }
      if (input.status !== undefined) {
        await tx.user.update({ where: { id }, data: { status: input.status === "active" ? "ACTIVE" : "SUSPENDED" } });
      }
      if (targetRoleId !== undefined) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.create({ data: { userId: id, roleId: targetRoleId } });
      }
      if (serverIds !== undefined) {
        await tx.userServerAccess.deleteMany({ where: { userId: id } });
        if (serverIds.length > 0) {
          await tx.userServerAccess.createMany({
            data: serverIds.map((serverId) => ({ id: ulid(), userId: id, serverId })),
          });
        }
      }
    });

    // Suspension must invalidate existing sessions immediately — done
    // outside the transaction since it's a separate, idempotent operation
    // against the Session table.
    if (input.status === "suspended") {
      await revokeAllUserSessions(app.prisma, id);
    }

    const changes: string[] = [];
    if (input.name !== undefined) changes.push(`name -> "${input.name}"`);
    if (input.role !== undefined) changes.push(`role -> ${input.role}`);
    if (input.status !== undefined) changes.push(`status -> ${input.status}`);
    if (input.serverIds !== undefined) changes.push("server access updated");

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "user.updated",
      description: `${request.user!.name} updated ${target.name}: ${changes.length > 0 ? changes.join(", ") : "no changes"}.`,
      targetType: "user",
      targetLabel: target.name,
      resourceId: id,
      severity: input.status === "suspended" ? "WARNING" : "INFO",
      ipAddress: request.ip,
    });

    const updated = await getUserWithAccess(app.prisma, id);
    return { user: toPlatformUserDto(updated!) };
  });

  app.delete("/api/v1/users/:id", { preHandler: app.requirePermission("users.manage") }, async (request) => {
    const { id } = request.params as { id: string };
    if (id === request.user!.id) {
      throw new ApiError(ErrorCode.FORBIDDEN, "You cannot delete your own account.");
    }

    const target = await getUserWithAccess(app.prisma, id);
    if (!target) throw new ApiError(ErrorCode.NOT_FOUND, "User not found.");

    const currentlyOwner = target.userRoles[0]?.role.name === "owner";
    if (currentlyOwner && (await isLastOwner(app.prisma, id))) {
      throw new ApiError(ErrorCode.CONFLICT, "Cannot delete the last remaining owner.");
    }

    // Cascades sessions, roles, server access, API keys etc. per schema
    // `onDelete: Cascade`.
    await app.prisma.user.delete({ where: { id } });

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "user.deleted",
      description: `${request.user!.name} deleted user ${target.name} (${target.email}).`,
      targetType: "user",
      targetLabel: target.name,
      resourceId: id,
      severity: "WARNING",
      ipAddress: request.ip,
    });

    return { ok: true };
  });

  app.get("/api/v1/roles", { preHandler: app.requirePermission("users.view") }, async () => {
    const roles: Array<RoleRow & { permissions: RolePermissionRow[]; _count: { userRoles: number } }> = await app.prisma.role.findMany({
      include: { permissions: true, _count: { select: { userRoles: true } } },
      orderBy: { priority: "asc" },
    });
    const dtos: RoleResponseDto[] = roles.map((r) => ({
      id: r.id,
      name: r.name,
      label: r.label,
      description: r.description,
      isSystem: r.isSystem,
      permissionIds: r.permissions.map((p: RolePermissionRow) => p.permissionId),
      memberCount: r._count.userRoles,
    }));
    return { roles: dtos };
  });

  // §10/§43: the "owner" role bypasses RBAC entirely via `isSuperAdmin`
  // (see docs/architecture.md §"RBAC") — it has no explicit permission set
  // to edit, so this rejects attempts to change it rather than silently
  // storing a permission list nothing ever reads.
  app.patch("/api/v1/roles/:id", { preHandler: app.requirePermission("users.manage") }, async (request) => {
    const { id } = request.params as { id: string };
    const { permissionIds } = UpdateRolePermissionsSchema.parse(request.body);

    const invalid = permissionIds.filter((p) => !isPermissionId(p));
    if (invalid.length > 0) {
      throw new ApiError(ErrorCode.VALIDATION_ERROR, `Unknown permission id(s): ${invalid.join(", ")}`);
    }

    const role: (RoleRow & { permissions: RolePermissionRow[] }) | null = await app.prisma.role.findUnique({
      where: { id },
      include: { permissions: true },
    });
    if (!role) throw new ApiError(ErrorCode.NOT_FOUND, "Role not found.");
    if (role.name === "owner") {
      throw new ApiError(ErrorCode.FORBIDDEN, "The owner role bypasses RBAC and has no editable permission set.");
    }

    const before = new Set<string>(role.permissions.map((p: RolePermissionRow) => p.permissionId));
    const after = new Set<string>(permissionIds);
    const added = permissionIds.filter((p) => !before.has(p));
    const removed = [...before].filter((p) => !after.has(p));

    await app.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
        });
      }
    });

    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "role.permissions_updated",
      description: `${request.user!.name} updated permissions for role "${role.label}" (+${added.length}/-${removed.length}).`,
      targetLabel: role.label,
      resourceId: role.id,
      severity: "WARNING",
      ipAddress: request.ip,
      metadata: { added, removed },
    });

    const updated: RoleRow & { permissions: RolePermissionRow[]; _count: { userRoles: number } } = await app.prisma.role.findUniqueOrThrow({
      where: { id },
      include: { permissions: true, _count: { select: { userRoles: true } } },
    });
    const dto: RoleResponseDto = {
      id: updated.id,
      name: updated.name,
      label: updated.label,
      description: updated.description,
      isSystem: updated.isSystem,
      permissionIds: updated.permissions.map((p: RolePermissionRow) => p.permissionId),
      memberCount: updated._count.userRoles,
    };
    return { role: dto };
  });
}
