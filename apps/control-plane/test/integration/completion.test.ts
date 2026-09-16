import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@mccore/database";
import { buildTestApp, resetDatabase, seedPermissionsAndRoles, ulid } from "../helpers/app.js";
import { consumeBootstrapCodeForSetup } from "../../src/modules/auth/bootstrap.js";
import { rememberConsole, consoleHistory } from "../../src/modules/servers/console-history.js";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

describe("completion regressions", () => {
  let app: FastifyInstance; let prisma: PrismaClient;
  beforeAll(async () => { ({ app, prisma } = await buildTestApp()); });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDatabase(prisma); await seedPermissionsAndRoles(prisma); });
  async function token() { const code = "MCCORE-TEST-ATOMIC"; await prisma.bootstrapToken.create({ data: { id: ulid(), codeHash: hash(code), expiresAt: new Date(Date.now() + 60000) } }); return code; }
  async function setup() {
    const code = await token();
    const response = await app.inject({ method: "POST", url: "/api/v1/setup/complete", payload: { code, name: "Test admin", email: "admin@example.test", password: "a long unique test passphrase" } });
    expect(response.statusCode).toBe(200);
    return { user: response.json().user, cookie: `mccore_session=${response.cookies[0].value}` };
  }
  it("creates exactly one administrator on concurrent setup submissions", async () => {
    const code = await token();
    const responses = await Promise.all([1, 2].map(n => app.inject({ method: "POST", url: "/api/v1/setup/complete", payload: { code, name: "Admin", email: `admin${n}@example.test`, password: "a long unique test passphrase" } })));
    expect(responses.filter(r => r.statusCode === 200)).toHaveLength(1);
    expect(await prisma.user.count()).toBe(1);
  });
  it("rolls back bootstrap consumption if administrator creation fails", async () => {
    const code = await token();
    await expect(consumeBootstrapCodeForSetup(prisma, code, async () => { throw new Error("database write failed"); })).rejects.toThrow("database write failed");
    expect((await prisma.bootstrapToken.findFirstOrThrow()).usedAt).toBeNull();
  });
  it("rejects cross-origin login requests before authentication", async () => {
    const response = await app.inject({ method: "POST", url: "/api/v1/auth/login", headers: { origin: "https://attacker.example" }, payload: { email: "admin@example.test", password: "password" } });
    expect(response.statusCode).toBe(403);
  });
  it("enforces API key scopes even when the owner is a super administrator", async () => {
    const { cookie } = await setup();
    const created = await app.inject({ method: "POST", url: "/api/v1/api-keys", headers: { cookie }, payload: { label: "Read only", scopes: ["server:read"] } });
    expect(created.statusCode).toBe(200);
    const authorization = `Bearer ${created.json().rawKey}`;
    expect((await app.inject({ method: "GET", url: "/api/v1/servers", headers: { authorization } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/api/v1/servers", headers: { authorization }, payload: {} })).statusCode).toBe(403);
    await app.inject({ method: "DELETE", url: `/api/v1/api-keys/${created.json().apiKey.id}`, headers: { cookie } });
    expect((await app.inject({ method: "GET", url: "/api/v1/servers", headers: { authorization } })).statusCode).toBe(401);
  });
  it("shares bounded console history across encapsulated route plugins", async () => {
    const routeScope = Object.create(app) as FastifyInstance;
    const serverId = ulid();
    rememberConsole(app, serverId, Array.from({ length: 510 }, (_, i) => ({ id: String(i), timestamp: new Date().toISOString(), level: "INFO", message: "line " + i })));
    rememberConsole(app, serverId, [{ invalid: true }]);
    const lines = consoleHistory(routeScope, serverId);
    expect(lines).toHaveLength(500);
    expect(lines[0].message).toBe("line 10");
    expect(lines.at(-1)?.message).toBe("line 509");
    expect(consoleHistory(routeScope, ulid())).toEqual([]);
  });
  it("returns 404 for an unknown operation", async () => {
    const { cookie } = await setup();
    const response = await app.inject({ method: "GET", url: `/api/v1/operations/${ulid()}`, headers: { cookie } });
    expect(response.statusCode).toBe(404);
  });
});
