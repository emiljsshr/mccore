import { hash, verify, Algorithm } from "@node-rs/argon2";

/**
 * §11: Argon2id, tuned to OWASP's current minimum recommendation for
 * server-side login hashing (19 MiB memory, 2 iterations, 1 lane) — a
 * deliberately different (slow, memory-hard) tool from the SHA-256 used
 * for high-entropy tokens elsewhere (see lib/tokens.ts).
 */
const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, candidate: string): Promise<boolean> {
  try {
    return await verify(passwordHash, candidate, ARGON2_OPTIONS);
  } catch {
    // Malformed/foreign hash string — treat as a failed verification, not a crash.
    return false;
  }
}

const MIN_PASSWORD_LENGTH = 8;

export function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > 256) {
    return "Password is too long.";
  }
  // Deliberately no composition rules (uppercase/digit/symbol quotas) —
  // NIST 800-63B recommends length over composition complexity, and
  // composition rules push users toward predictable patterns.
  return null;
}
