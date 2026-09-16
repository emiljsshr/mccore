import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CONTROL_PLANE_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CONTROL_PLANE_URL: z.string().url().default("http://127.0.0.1:4000"),
  PUBLIC_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  ENCRYPTION_KEY: z.string().min(32, "ENCRYPTION_KEY must be at least 32 chars (base64 of 32 bytes)"),
  STORAGE_PATH: z.string().default("./.data/servers"),
  BACKUP_PATH: z.string().default("./.data/backups"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const data = parsed.data;
  return {
    ...data,
    isProduction: data.NODE_ENV === "production",
    cookieName: "mccore_session",
    sessionTtlMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    bootstrapTtlMs: 30 * 60 * 1000, // 30 minutes
    enrollmentTtlMs: 15 * 60 * 1000, // 15 minutes
    passwordResetTtlMs: 60 * 60 * 1000, // 1 hour
    agentHandshakeWindowMs: 60 * 1000,
    agentProtocolVersion: 1,
  };
}
