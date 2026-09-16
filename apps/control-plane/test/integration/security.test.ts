import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@mccore/database";
import { buildTestApp, resetDatabase, seedPermissionsAndRoles, ulid } from "../helpers/app.js";
import { hashPassword } from "../../src/modules/auth/password.js";

function sha256Hex(s: string) {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

async function insertEnrollmentToken(prisma: PrismaClient, token: string, opts: { expiresInMs?: number; used?: boolean } = {}) {
  await prisma.enrollmentToken.create({
    data: {
      id: ulid(),
      label: "test node",
      tokenHash: sha256Hex(token),
      expiresAt: new Date(Date.now() + (opts.expiresInMs ?? 15 * 60 * 1000)),
      usedAt: opts.used ? new Date() : null,
    },
  });
}

function validEnrollPayload(token: string) {
  return {
    enrollmentToken: token,
    publicKey: randomBytes(32).toString("base64"),
    hostname: "test-host",
    os: "Ubuntu 24.04",
    kernel: "6.8.0",
    arch: "amd64",
    cpuModel: "Test CPU",
    cpuCores: 4,
    memoryTotalMb: 8192,
    diskTotalMb: 102400,
    ipAddress: "10.0.0.5",
    javaInstallations: [],
    agentVersion: "0.1.0",
    protocolVersion: 1,
  };
}

describe("node enrollment security (§16/§42)", () => {
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

  it("rejects an unknown enrollment token", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v1/nodes/enroll", payload: validEnrollPayload("never-issued-token") });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("ENROLLMENT_TOKEN_INVALID");
  });

  it("rejects an expired enrollment token", async () => {
    await insertEnrollmentToken(prisma, "expired-token", { expiresInMs: -1000 });
    const res = await app.inject({ method: "POST", url: "/api/v1/nodes/enroll", payload: validEnrollPayload("expired-token") });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("ENROLLMENT_TOKEN_EXPIRED");
  });

  it("accepts a valid token exactly once, then rejects reuse", async () => {
    await insertEnrollmentToken(prisma, "one-time-token");

    const first = await app.inject({ method: "POST", url: "/api/v1/nodes/enroll", payload: validEnrollPayload("one-time-token") });
    expect(first.statusCode).toBe(200);
    expect(first.json().nodeId).toBeTruthy();

    const second = await app.inject({ method: "POST", url: "/api/v1/nodes/enroll", payload: validEnrollPayload("one-time-token") });
    expect(second.statusCode).toBe(401);
    expect(second.json().error.code).toBe("ENROLLMENT_TOKEN_USED");
  });

  it("rejects an already-used token even if resubmitted concurrently (transactional single-use)", async () => {
    await insertEnrollmentToken(prisma, "race-token");
    const [a, b] = await Promise.all([
      app.inject({ method: "POST", url: "/api/v1/nodes/enroll", payload: validEnrollPayload("race-token") }),
      app.inject({ method: "POST", url: "/api/v1/nodes/enroll", payload: validEnrollPayload("race-token") }),
    ]);
    const statuses = [a.statusCode, b.statusCode].sort();
    // Exactly one must succeed and one must fail — never both succeeding
    // (which would mean two nodes silently sharing one enrollment record).
    expect(statuses).toEqual([200, 401]);
  });
});

describe("rate limiting (§47)", () => {
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
    await prisma.user.create({
      data: {
        id: ulid(),
        name: "Rate Limit Target",
        email: "ratelimit@example.com",
        passwordHash: await hashPassword("does not matter here"),
        avatarSeed: "x",
        status: "ACTIVE",
      },
    });
  });

  it("locks out repeated failed login attempts from the same client", async () => {
    let sawRateLimit = false;
    for (let i = 0; i < 15; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "ratelimit@example.com", password: "wrong-password" },
      });
      if (res.statusCode === 429) {
        sawRateLimit = true;
        break;
      }
      expect(res.statusCode).toBe(401);
    }
    expect(sawRateLimit).toBe(true);
  });

  it("locks out repeated bootstrap-code verification attempts", async () => {
    let sawRateLimit = false;
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/setup/verify-code",
        payload: { code: "MCCORE-GUESS-" + i },
      });
      if (res.statusCode === 429) {
        sawRateLimit = true;
        break;
      }
    }
    expect(sawRateLimit).toBe(true);
  });
});
