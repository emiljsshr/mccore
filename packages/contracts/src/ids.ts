/**
 * ULID generation (https://github.com/ulid/spec) — Crockford Base32 encoding
 * of a 48-bit millisecond timestamp followed by 80 bits of CSPRNG randomness.
 * This is an encoding, not a cryptographic primitive: no security property
 * depends on it beyond "don't use `Math.random()`", which is why it's safe
 * to implement locally instead of adding a dependency for ~40 lines.
 *
 * Used for every external/public + primary-key ID in the system (users,
 * servers, nodes, backups, ...). Monotonic-enough ordering is a deliberate
 * feature (roughly time-sortable IDs), not a leak: these are opaque
 * resource identifiers, not sequential integers, so they don't enable
 * enumeration of *other* resources the way `/servers/1`, `/servers/2` would.
 */

const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ENCODING_LENGTH = 32;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function getRandomBytes(length: number): Uint8Array {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }
  // Node < 19 fallback (control plane targets current LTS, but keep this
  // resilient rather than assuming globalThis.crypto is always present).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require("node:crypto") as typeof import("node:crypto");
  return new Uint8Array(nodeCrypto.randomBytes(length));
}

function encodeTime(now: number): string {
  let mod: number;
  let str = "";
  let time = now;
  for (let i = TIME_LEN; i > 0; i--) {
    mod = time % ENCODING_LENGTH;
    str = CROCKFORD_ALPHABET.charAt(mod) + str;
    time = (time - mod) / ENCODING_LENGTH;
  }
  return str;
}

function encodeRandom(): string {
  const bytes = getRandomBytes(RANDOM_LEN);
  let str = "";
  for (let i = 0; i < RANDOM_LEN; i++) {
    str += CROCKFORD_ALPHABET.charAt(bytes[i] % ENCODING_LENGTH);
  }
  return str;
}

/** Generates a new 26-character ULID. */
export function ulid(seedTime: number = Date.now()): string {
  return encodeTime(seedTime) + encodeRandom();
}

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function isValidUlid(value: string): boolean {
  return ULID_RE.test(value);
}

/** Prefixed ULID, e.g. `srv_01J...` — nicer in logs/URLs, still just an opaque ID. */
export function prefixedUlid(prefix: string, seedTime?: number): string {
  return `${prefix}_${ulid(seedTime)}`;
}
