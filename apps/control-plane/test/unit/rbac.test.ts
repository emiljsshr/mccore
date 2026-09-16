import { describe, it, expect } from "vitest";
import { hasPermission, canAccessServer, type SessionContext } from "../../src/modules/auth/session-context.js";

function ctx(overrides: Partial<SessionContext>): SessionContext {
  return {
    id: "user1",
    name: "Test User",
    email: "test@example.com",
    avatarSeed: "user1",
    role: "viewer",
    isSuperAdmin: false,
    permissions: [],
    permissionSet: new Set(),
    serverIds: [],
    totpEnabled: false,
    ...overrides,
  };
}

describe("hasPermission", () => {
  it("super admin bypasses every permission check", () => {
    const c = ctx({ isSuperAdmin: true, permissionSet: new Set() });
    expect(hasPermission(c, "server.delete")).toBe(true);
    expect(hasPermission(c, "anything.not.real")).toBe(true);
  });

  it("a normal user only has explicitly granted permissions", () => {
    const c = ctx({ permissionSet: new Set(["server.view"]) });
    expect(hasPermission(c, "server.view")).toBe(true);
    expect(hasPermission(c, "server.delete")).toBe(false);
  });
});

describe("canAccessServer", () => {
  it("super admin can access any server", () => {
    const c = ctx({ isSuperAdmin: true, serverIds: [] });
    expect(canAccessServer(c, "srv-anything")).toBe(true);
  });

  it("null serverIds means global access (e.g. administrator role)", () => {
    const c = ctx({ serverIds: null });
    expect(canAccessServer(c, "srv-anything")).toBe(true);
  });

  it("a scoped user can only access listed servers", () => {
    const c = ctx({ serverIds: ["srv-a", "srv-b"] });
    expect(canAccessServer(c, "srv-a")).toBe(true);
    expect(canAccessServer(c, "srv-c")).toBe(false);
  });

  it("a scoped user with an empty list can access nothing", () => {
    const c = ctx({ serverIds: [] });
    expect(canAccessServer(c, "srv-a")).toBe(false);
  });
});
