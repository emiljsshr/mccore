import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

/**
 * High-entropy random secrets (bootstrap codes, session tokens, enrollment
 * tokens, API keys, password reset tokens) are hashed with SHA-256 before
 * storage — see docs/architecture.md §2 for why this (not Argon2id) is the
 * correct tool here. Comparison against a stored hash re-hashes the
 * candidate and compares digests with `timingSafeEqual`.
 */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashMatches(candidate: string, storedHex: string): boolean {
  const candidateHex = sha256Hex(candidate);
  const a = Buffer.from(candidateHex, "hex");
  const b = Buffer.from(storedHex, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Opaque URL-safe random token, e.g. for session cookies / API keys. */
export function randomToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // no I, L, O, U — avoids ambiguity when read aloud/typed

/**
 * §8: bootstrap / enrollment "human" codes. Generates 128 bits of CSPRNG
 * entropy, encodes it Crockford-Base32, and groups it for readability. The
 * spec's example format (`MCCORE-XXXX-XXXX-XXXX`, 12 symbols = 60 bits) is
 * explicitly "format only, not the entropy target" — 128 bits requires 26
 * symbols, so the real code is longer than the illustrative example.
 */
export function generateHumanCode(prefix: string, groupSize = 4): string {
  const bytes = randomBytes(16); // 128 bits
  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);
  let out = "";
  // 26 base32 chars encode 130 bits, comfortably covering the 128-bit input.
  for (let i = 0; i < 26; i++) {
    out = CROCKFORD[Number(bits & 0x1fn)] + out;
    bits >>= 5n;
  }
  const groups: string[] = [];
  for (let i = 0; i < out.length; i += groupSize) {
    groups.push(out.slice(i, i + groupSize));
  }
  return `${prefix}-${groups.join("-")}`;
}

export function normalizeHumanCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}
