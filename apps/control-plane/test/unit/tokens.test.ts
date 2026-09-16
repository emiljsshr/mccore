import { describe, it, expect } from "vitest";
import { sha256Hex, hashMatches, randomToken, generateHumanCode, normalizeHumanCode } from "../../src/lib/tokens.js";

describe("sha256Hex / hashMatches", () => {
  it("produces a stable, verifiable hash", () => {
    const hash = sha256Hex("hello world");
    expect(hash).toHaveLength(64);
    expect(hashMatches("hello world", hash)).toBe(true);
  });

  it("rejects a wrong candidate", () => {
    const hash = sha256Hex("correct-value");
    expect(hashMatches("wrong-value", hash)).toBe(false);
  });

  it("rejects a truncated/malformed stored hash without throwing", () => {
    expect(hashMatches("anything", "not-a-real-hash")).toBe(false);
  });
});

describe("randomToken", () => {
  it("generates distinct, sufficiently long tokens", () => {
    const a = randomToken(32);
    const b = randomToken(32);
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(30);
  });
});

describe("generateHumanCode", () => {
  it("has at least 128 bits of entropy encoded (26 Crockford chars)", () => {
    const code = generateHumanCode("MCCORE");
    const withoutPrefix = code.replace(/^MCCORE-/, "").replace(/-/g, "");
    expect(withoutPrefix).toHaveLength(26);
  });

  it("only uses the Crockford Base32 alphabet (no ambiguous I/L/O/U)", () => {
    const code = generateHumanCode("MCCORE");
    const body = code.replace(/^MCCORE-/, "").replace(/-/g, "");
    expect(body).toMatch(/^[0-9A-HJKMNP-TV-Z]+$/);
  });

  it("generates unique codes across many calls", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateHumanCode("MCCORE")));
    expect(codes.size).toBe(200);
  });
});

describe("normalizeHumanCode", () => {
  it("uppercases and strips whitespace", () => {
    expect(normalizeHumanCode(" mccore-abcd-1234 ")).toBe("MCCORE-ABCD-1234");
  });

  it("collapses internal whitespace someone might paste in", () => {
    expect(normalizeHumanCode("mccore- abcd -1234")).toBe("MCCORE-ABCD-1234");
  });
});
