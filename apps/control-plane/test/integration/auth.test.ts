import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@mccore/database";
import { buildTestApp, resetDatabase, seedPermissionsAndRoles, ulid } from "../helpers/app.js";
import { hashPassword } from "../../src/modules/auth/password.js";

async function createUser(prisma: PrismaClient, opts: { email: string; password: string; role: "owner" | "administrator" | "viewer"; status?: "ACTIVE" | "SUSPENDED" }) {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: opts.role } });
  const userId = ulid();
  await prisma.user.create({
    data: {
      id: userId,
      name: "Test User",
      email: opts.email,
      passwordHash: await hashPassword(opts.password),
      avatarSeed: userId,
      isSuperAdmin: opts.role === "owner",
      status: opts.status ?? "ACTIVE",
    },
  });
  await prisma.userRole.create({ data: { userId, roleId: role.id } });
  return userId;
}

function getCookie(res: { cookies: Array<{ name: string; value: string }> }) {
  const c = res.cookies.find((c) => c.name === "mccore_session");
  return c ? `mccore_session=${c.value}` : "";
}

describe("authentication (§11)", () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase(prisma);
    await seedPermissionsAndRoles(prisma);
  });

  it("logs in with correct credentials and sets a session cookie", async () => {
    await createUser(prisma, { email: "user@example.com", password: "correct horse battery staple", role: "administrator" });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "user@example.com", password: "correct horse battery staple" },
    });
    expect(res.statusCode).toBe(200);
    expect(getCookie(res)).not.toBe("");
  });

  it("rejects an invalid password with a generic error (no user-existence leak)", async () => {
    await createUser(prisma, { email: "user@example.com", password: "correct horse battery staple", role: "administrator" });
    const wrongPassword = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "user@example.com", password: "totally wrong" },
    });
    const unknownEmail = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "nobody@example.com", password: "totally wrong" },
    });
    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPassword.json().error.code).toBe("INVALID_CREDENTIALS");
    expect(unknownEmail.json().error.code).toBe("INVALID_CREDENTIALS");
    expect(wrongPassword.json().error.message).toBe(unknownEmail.json().error.message);
  });

  it("refuses a suspended account even with the correct password", async () => {
    await createUser(prisma, { email: "suspended@example.com", password: "correct horse battery staple", role: "administrator", status: "SUSPENDED" });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "suspended@example.com", password: "correct horse battery staple" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("ACCOUNT_SUSPENDED");
  });

  it("returns the current session for an authenticated request", async () => {
    await createUser(prisma, { email: "user@example.com", password: "correct horse battery staple", role: "administrator" });
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "user@example.com", password: "correct horse battery staple" },
    });
    const session = await app.inject({
      method: "GET",
      url: "/api/v1/auth/session",
      headers: { cookie: getCookie(login) },
    });
    expect(session.statusCode).toBe(200);
    expect(session.json().user.email).toBe("user@example.com");
  });

  it("rejects an unauthenticated request to a protected endpoint", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/auth/session" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("UNAUTHENTICATED");
  });

  it("logout invalidates the session — a subsequent request with the same cookie is rejected", async () => {
    await createUser(prisma, { email: "user@example.com", password: "correct horse battery staple", role: "administrator" });
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "user@example.com", password: "correct horse battery staple" },
    });
    const cookie = getCookie(login);

    const logout = await app.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { cookie } });
    expect(logout.statusCode).toBe(200);

    const after = await app.inject({ method: "GET", url: "/api/v1/auth/session", headers: { cookie } });
    expect(after.statusCode).toBe(401);
  });

  it("changing password revokes all other sessions", async () => {
    const userId = await createUser(prisma, { email: "user@example.com", password: "old password here", role: "administrator" });
    const session1 = getCookie(await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "user@example.com", password: "old password here" } }));
    const session2 = getCookie(await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "user@example.com", password: "old password here" } }));

    const change = await app.inject({
      method: "POST",
      url: "/api/v1/auth/change-password",
      headers: { cookie: session1 },
      payload: { currentPassword: "old password here", newPassword: "brand new password here" },
    });
    expect(change.statusCode).toBe(200);

    // session2 (a different device/tab) must now be revoked.
    const session2Check = await app.inject({ method: "GET", url: "/api/v1/auth/session", headers: { cookie: session2 } });
    expect(session2Check.statusCode).toBe(401);

    void userId;
  });
});

describe("RBAC enforcement over HTTP (§43)", () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDatabase(prisma);
    await seedPermissionsAndRoles(prisma);
  });

  it("a viewer cannot create a server (missing server.create permission)", async () => {
    await createUser(prisma, { email: "viewer@example.com", password: "viewer password here", role: "viewer" });
    const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "viewer@example.com", password: "viewer password here" } });
    const cookie = getCookie(login);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/servers",
      headers: { cookie },
      payload: { name: "x" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("an administrator (global access) can list servers with an empty result rather than being forbidden", async () => {
    await createUser(prisma, { email: "admin@example.com", password: "admin password here", role: "administrator" });
    const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "admin@example.com", password: "admin password here" } });
    const res = await app.inject({ method: "GET", url: "/api/v1/servers", headers: { cookie: getCookie(login) } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ servers: [] });
  });

  it("nodes.view is required to list nodes — a viewer without it is forbidden", async () => {
    // viewer role (per packages/contracts DEFAULT_ROLE_PERMISSIONS) does include nodes.view;
    // this test instead confirms an entirely permission-less custom scenario is forbidden by
    // stripping the viewer role's permissions first.
    await prisma.rolePermission.deleteMany({ where: { role: { name: "viewer" } } });
    await createUser(prisma, { email: "noperms@example.com", password: "no perms password", role: "viewer" });
    const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "noperms@example.com", password: "no perms password" } });
    const res = await app.inject({ method: "GET", url: "/api/v1/nodes", headers: { cookie: getCookie(login) } });
    expect(res.statusCode).toBe(403);
  });
});
