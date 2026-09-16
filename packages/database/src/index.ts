import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

export * from "./generated/prisma/client.js";
export * from "./generated/prisma/enums.js";

let client: PrismaClient | undefined;

/**
 * Lazily-created singleton PrismaClient using the `pg` driver adapter
 * (required by the Prisma 7 client generator). Lazy so importing this
 * module doesn't require `DATABASE_URL` to be set (e.g. contracts-only
 * consumers, or tooling that imports types without touching the DB).
 */
export function getPrismaClient(): PrismaClient {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    const adapter = new PrismaPg({ connectionString });
    client = new PrismaClient({ adapter });
  }
  return client;
}
