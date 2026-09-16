import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 20_000,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } }, // tests share one Postgres test DB — avoid cross-worker interference
  },
});
