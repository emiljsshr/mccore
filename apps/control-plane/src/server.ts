import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnvFile } from "dotenv";
import closeWithGrace from "close-with-grace";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@mccore/database";
import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";

// Single source of truth for env (§52): repo-root .env in dev, or
// /etc/mccore/mccore.env in production (loaded by the systemd unit's
// EnvironmentFile= directive, in which case this is a harmless no-op
// since those variables are already in process.env).
const here = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile({ path: path.resolve(here, "../../../.env") });

async function main() {
  const config = loadConfig();
  const adapter = new PrismaPg({ connectionString: config.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const app = await buildApp({ config, prisma, startScheduler: true });

  closeWithGrace({ delay: 10_000 }, async ({ signal, err }) => {
    if (err) app.log.error({ err }, "closing due to error");
    else app.log.info({ signal }, "shutting down gracefully");
    await app.close();
  });

  try {
    await app.listen({ port: config.CONTROL_PLANE_PORT, host: "127.0.0.1" });
  } catch (err) {
    app.log.error({ err }, "failed to start server");
    process.exit(1);
  }
}

main();
