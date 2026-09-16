import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM at-rest encryption for secrets that must be *recoverable*
 * (TOTP shared secrets — needed to verify future codes), as opposed to
 * tokens/passwords which are one-way hashed because we only ever need to
 * compare, never decrypt. `ENCRYPTION_KEY` is a base64-encoded 32-byte key
 * from /etc/mccore/mccore.env (§52), never derived from a password.
 */
export function encryptSecret(plaintext: string, encryptionKeyB64: string): string {
  const key = Buffer.from(encryptionKeyB64, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must decode to 32 bytes");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), ciphertext.toString("base64"), authTag.toString("base64")].join(".");
}

export function decryptSecret(payload: string, encryptionKeyB64: string): string {
  const key = Buffer.from(encryptionKeyB64, "base64");
  const [ivB64, ciphertextB64, authTagB64] = payload.split(".");
  if (!ivB64 || !ciphertextB64 || !authTagB64) throw new Error("Malformed encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}
