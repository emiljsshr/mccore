import { describe, it, expect } from "vitest";
import { computeNextRun } from "../../src/lib/cron.js";
import { ApiError } from "@mccore/contracts";

describe("computeNextRun", () => {
  it("computes the next daily occurrence", () => {
    const from = new Date("2026-01-01T10:00:00Z");
    const next = computeNextRun("0 3 * * *", "UTC", from);
    expect(next.toISOString()).toBe("2026-01-02T03:00:00.000Z");
  });

  it("respects a non-UTC timezone", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    const next = computeNextRun("0 9 * * *", "America/New_York", from);
    // 09:00 America/New_York on Jan 1 (EST, UTC-5) is 14:00 UTC.
    expect(next.toISOString()).toBe("2026-01-01T14:00:00.000Z");
  });

  it("throws an ApiError for an invalid cron expression", () => {
    expect(() => computeNextRun("not a cron expression", "UTC")).toThrow(ApiError);
  });

  it("throws an ApiError for an invalid timezone", () => {
    expect(() => computeNextRun("0 3 * * *", "Not/AZone")).toThrow(ApiError);
  });
});
