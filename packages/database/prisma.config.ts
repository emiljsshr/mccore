import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

const here = path.dirname(fileURLToPath(import.meta.url));
// Single source of truth for env (§52): repo-root .env in dev, or
// /etc/mccore/mccore.env in production (loaded by the systemd unit's
// EnvironmentFile= directive, not by this file).
loadEnv({ path: path.resolve(here, "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
