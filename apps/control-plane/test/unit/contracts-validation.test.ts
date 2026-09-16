import { describe, it, expect } from "vitest";
import { RelativeServerPathSchema, MinecraftUsernameSchema, MinecraftUuidSchema, CronExpressionSchema } from "@mccore/contracts";

describe("RelativeServerPathSchema (path traversal defense-in-depth, layer 1 of 2 — see internal/fsops for the Agent's own independent check)", () => {
  const valid = ["server.properties", "plugins/Foo.jar", "world/region/r.0.0.mca", "a/b/c.txt"];
  const invalid = [
    "../outside",
    "../../etc/passwd",
    "a/../../b",
    "/etc/passwd",
    "a/b/../../../c",
    "",
  ];

  for (const p of valid) {
    it(`accepts ${JSON.stringify(p)}`, () => {
      expect(() => RelativeServerPathSchema.parse(p)).not.toThrow();
    });
  }
  for (const p of invalid) {
    it(`rejects ${JSON.stringify(p)}`, () => {
      expect(() => RelativeServerPathSchema.parse(p)).toThrow();
    });
  }

  it("rejects embedded null bytes", () => {
    expect(() => RelativeServerPathSchema.parse("file\0.txt")).toThrow();
  });
});

describe("MinecraftUsernameSchema (console-command injection defense)", () => {
  it("accepts valid Minecraft usernames", () => {
    expect(() => MinecraftUsernameSchema.parse("Notch")).not.toThrow();
    expect(() => MinecraftUsernameSchema.parse("a_b_C123")).not.toThrow();
  });

  it("rejects a username containing a newline (stdin command injection)", () => {
    expect(() => MinecraftUsernameSchema.parse("Notch\nban Steve")).toThrow();
  });

  it("rejects a username containing spaces", () => {
    expect(() => MinecraftUsernameSchema.parse("Not a name")).toThrow();
  });

  it("rejects usernames outside the 3-16 character range", () => {
    expect(() => MinecraftUsernameSchema.parse("ab")).toThrow();
    expect(() => MinecraftUsernameSchema.parse("a".repeat(17))).toThrow();
  });
});

describe("MinecraftUuidSchema", () => {
  it("accepts a well-formed UUID", () => {
    expect(() => MinecraftUuidSchema.parse("069a79f4-44e9-4726-a5be-fca90e38aaf5")).not.toThrow();
  });

  it("rejects a malformed UUID", () => {
    expect(() => MinecraftUuidSchema.parse("not-a-uuid")).toThrow();
  });
});

describe("CronExpressionSchema", () => {
  it("accepts a standard 5-field cron expression", () => {
    expect(() => CronExpressionSchema.parse("0 3 * * *")).not.toThrow();
  });

  it("rejects a 6-field or malformed expression", () => {
    expect(() => CronExpressionSchema.parse("* * * * * *")).toThrow();
    expect(() => CronExpressionSchema.parse("not a cron")).toThrow();
  });
});
