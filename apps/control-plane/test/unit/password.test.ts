import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../../src/modules/auth/password.js";

describe("password hashing", () => {
  it("hashes and verifies correctly", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword(hash, "correct horse battery staple")).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword(hash, "wrong password")).toBe(false);
  });

  it("produces different hashes for the same password (random salt)", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });

  it("does not throw on a malformed stored hash, just returns false", async () => {
    await expect(verifyPassword("not-a-real-hash", "anything")).resolves.toBe(false);
  });
});

describe("validatePasswordStrength", () => {
  it("rejects short passwords", () => {
    expect(validatePasswordStrength("short")).not.toBeNull();
  });

  it("accepts a reasonable password with no composition requirements", () => {
    expect(validatePasswordStrength("just a long passphrase")).toBeNull();
  });

  it("rejects excessively long passwords", () => {
    expect(validatePasswordStrength("a".repeat(300))).not.toBeNull();
  });
});
