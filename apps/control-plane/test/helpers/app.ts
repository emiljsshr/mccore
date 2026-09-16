import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@mccore/database";
import { PERMISSIONS as CONTRACT_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS as CONTRACT_ROLE_PERMS, ROLE_LABEL as CONTRACT_ROLE_LABEL, ulid } from "@mccore/contracts";
import { buildApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, "../../../../.env.test") });
loadEnv({ path: path.resolve(here, "../../../../.env") }); // fallback for SESSION_SECRET/ENCRYPTION_KEY if .env.test omits them

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://mccore:mccore@127.0.0.1:5432/mccore_test";
if (!new URL(process.env.DATABASE_URL).pathname.endsWith("_test")) {
  throw new Error("Refusing destructive tests: database name must end in _test.");
}
process.env.NODE_ENV = "test";

export async function buildTestApp() {
  const config = loadConfig(process.env);
  const adapter = new PrismaPg({ connectionString: config.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  const app = await buildApp({ config, prisma, logger: false, startScheduler: false });
  return { app, prisma };
}

/** Truncates every app-data table between tests, keeping the schema. */
export async function resetDatabase(prisma: PrismaClient) {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const names = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
}

/** Seeds the permission catalog + system roles — required before any RBAC-dependent test. */
export async function seedPermissionsAndRoles(prisma: PrismaClient) {
  for (const perm of CONTRACT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { id: perm.id },
      update: { label: perm.label, description: perm.description, group: perm.group },
      create: { id: perm.id, label: perm.label, description: perm.description, group: perm.group },
    });
  }
  const priority: Record<string, number> = { owner: 0, administrator: 1, developer: 2, moderator: 3, viewer: 4 };
  const globalAccess: Record<string, boolean> = { owner: true, administrator: true, developer: false, moderator: false, viewer: false };
  for (const name of ["owner", "administrator", "developer", "moderator", "viewer"] as const) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: {
        id: ulid(),
        name,
        label: CONTRACT_ROLE_LABEL[name],
        description: `Built-in ${CONTRACT_ROLE_LABEL[name]} role`,
        isSystem: true,
        isGlobalAccess: globalAccess[name],
        priority: priority[name],
      },
    });
    const permIds = name === "owner" ? [] : CONTRACT_ROLE_PERMS[name];
    if (permIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permIds.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }
  }
}

export { ulid };
