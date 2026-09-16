import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  PERMISSIONS,
  PERMISSION_GROUP_LABEL,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_LABEL,
  ulid,
} from "@mccore/contracts";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding permission catalog...");
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { id: perm.id },
      update: { label: perm.label, description: perm.description, group: perm.group },
      create: { id: perm.id, label: perm.label, description: perm.description, group: perm.group },
    });
  }
  void PERMISSION_GROUP_LABEL;

  console.log("Seeding system roles...");
  const rolePriority: Record<string, number> = {
    owner: 0,
    administrator: 1,
    developer: 2,
    moderator: 3,
    viewer: 4,
  };
  const roleGlobalAccess: Record<string, boolean> = {
    owner: true,
    administrator: true,
    developer: false,
    moderator: false,
    viewer: false,
  };

  // "owner" has no explicit permission rows — SUPER_ADMIN bypasses RBAC
  // entirely in the authorization middleware (§10). It exists as a row so
  // it has a stable id/label for display.
  const roleNames = ["owner", "administrator", "developer", "moderator", "viewer"] as const;
  for (const name of roleNames) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {
        label: ROLE_LABEL[name],
        isGlobalAccess: roleGlobalAccess[name],
        priority: rolePriority[name],
      },
      create: {
        id: ulid(),
        name,
        label: ROLE_LABEL[name],
        description: `Built-in ${ROLE_LABEL[name]} role`,
        isSystem: true,
        isGlobalAccess: roleGlobalAccess[name],
        priority: rolePriority[name],
      },
    });

    const permIds = name === "owner" ? [] : DEFAULT_ROLE_PERMISSIONS[name];
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permIds.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
