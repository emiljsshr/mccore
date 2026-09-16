import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@mccore/database";
import { buildTestApp, resetDatabase, seedPermissionsAndRoles, ulid } from "../helpers/app.js";

function sha256Hex(s: string) {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

async function insertBootstrapToken(prisma: PrismaClient, code: string, opts: { expiresInMs?: number; attempts?: number } = {}) {
  await prisma.bootstrapToken.create({
    data: {
      id: ulid(),
      codeHash: sha256Hex(code),
      expiresAt: new Date(Date.now() + (opts.expiresInMs ?? 30 * 60 * 1000)),
      attempts: opts.attempts ?? 0,
    },
  });
}

describe("bootstrap / first-run setup (§8, §9)", () => {
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

  it("reports setup incomplete when there are no users", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/setup/status" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ complete: false });
  });

  it("rejects an invalid bootstrap code", async () => {
    await insertBootstrapToken(prisma, "MCCORE-REAL-CODE");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/setup/verify-code",
      payload: { code: "MCCORE-WRONG-CODE" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("BOOTSTRAP_CODE_INVALID");
  });

  it("rejects an expired bootstrap code", async () => {
    await insertBootstrapToken(prisma, "MCCORE-EXPIRED-CODE", { expiresInMs: -1000 });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/setup/verify-code",
      payload: { code: "MCCORE-EXPIRED-CODE" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("BOOTSTRAP_CODE_EXPIRED");
  });

  it("accepts a valid, unexpired bootstrap code", async () => {
    await insertBootstrapToken(prisma, "MCCORE-VALID-CODE");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/setup/verify-code",
      payload: { code: "MCCORE-VALID-CODE" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ valid: true });
  });

  it("completes setup, creates a super admin, and invalidates the code (single use)", async () => {
    await insertBootstrapToken(prisma, "MCCORE-ONE-TIME-CODE");

    const complete = await app.inject({
      method: "POST",
      url: "/api/v1/setup/complete",
      payload: {
        code: "MCCORE-ONE-TIME-CODE",
        name: "Jane Doe",
        email: "first@example.com",
        password: "correct horse battery staple",
      },
    });
    expect(complete.statusCode).toBe(200);
    const body = complete.json();
    expect(body.user.isSuperAdmin).toBe(true);
    expect(body.user.role).toBe("owner");
    // Session cookie must be set so the user is auto-logged-in (§9).
    expect(complete.cookies.some((c) => c.name === "mccore_session")).toBe(true);

    const statusAfter = await app.inject({ method: "GET", url: "/api/v1/setup/status" });
    expect(statusAfter.json()).toEqual({ complete: true });

    // Reusing the same code must fail — it's single-use.
    await insertBootstrapToken(prisma, "MCCORE-SHOULD-NOT-MATTER"); // a second token existing doesn't change the outcome below
    const reuse = await app.inject({
      method: "POST",
      url: "/api/v1/setup/complete",
      payload: {
        code: "MCCORE-ONE-TIME-CODE",
        name: "Second Admin",
        email: "second@example.com",
        password: "another long passphrase",
      },
    });
    expect(reuse.statusCode).toBe(409);
    expect(reuse.json().error.code).toBe("SETUP_ALREADY_COMPLETE");
  });

  it("locks out a bootstrap code after too many failed attempts", async () => {
    await insertBootstrapToken(prisma, "MCCORE-LOCKOUT-CODE", { attempts: 10 });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/setup/verify-code",
      payload: { code: "MCCORE-LOCKOUT-CODE" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.message).toMatch(/too many failed attempts/i);
  });

  it("rejects a weak password on setup completion", async () => {
    await insertBootstrapToken(prisma, "MCCORE-WEAK-PW-CODE");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/setup/complete",
      payload: { code: "MCCORE-WEAK-PW-CODE", name: "Admin", email: "admin@example.com", password: "short" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("PASSWORD_TOO_WEAK");
  });
});
