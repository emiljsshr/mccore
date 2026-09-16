import pino from "pino";
import type { AppConfig } from "./config.js";

/**
 * §11/§45/§8: never log passwords, tokens, bootstrap/enrollment codes,
 * session cookies or API keys. This redaction list is the enforcement
 * point — every log call site should still avoid putting secrets in
 * unlisted fields, but this is the backstop.
 */
const REDACT_PATHS = [
  "req.headers.cookie",
  "req.headers.authorization",
  "*.password",
  "*.passwordHash",
  "*.token",
  "*.bootstrapCode",
  "*.enrollmentToken",
  "*.sessionToken",
  "*.apiKey",
  "*.secret",
  "*.signature",
];

export function createLogger(config: Pick<AppConfig, "LOG_LEVEL" | "isProduction">) {
  return pino({
    level: config.LOG_LEVEL,
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    transport: config.isProduction
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" } },
  });
}

export type Logger = ReturnType<typeof createLogger>;
