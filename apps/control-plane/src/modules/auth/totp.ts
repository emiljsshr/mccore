import { ApiError, ErrorCode } from "@mccore/contracts";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import type { PrismaClient, Prisma } from "@mccore/database";
import { ulid } from "@mccore/contracts";
import { encryptSecret, decryptSecret } from "../../lib/crypto.js";
import { randomToken, sha256Hex } from "../../lib/tokens.js";

const ISSUER = "mcCore";
const RECOVERY_CODE_COUNT = 10;

function buildTotp(secretBase32: string, email: string) {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

export async function startTotpSetup(prisma: PrismaClient, encryptionKey: string, userId: string, email: string) {
  const existing = await prisma.twoFactorCredential.findUnique({ where: { userId } });
  if (existing?.enabled) throw new ApiError(ErrorCode.CONFLICT, "Disable the existing authenticator before replacing it.");
  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = buildTotp(secret.base32, email);
  const uri = totp.toString();
  const qrDataUrl = await QRCode.toDataURL(uri);

  await prisma.twoFactorCredential.upsert({
    where: { userId },
    update: { secretEncrypted: encryptSecret(secret.base32, encryptionKey), enabled: false, confirmedAt: null },
    create: { id: ulid(), userId, secretEncrypted: encryptSecret(secret.base32, encryptionKey), enabled: false },
  });

  return { secret: secret.base32, otpauthUri: uri, qrDataUrl };
}

export async function verifyTotpCode(
  prisma: PrismaClient,
  encryptionKey: string,
  userId: string,
  email: string,
  code: string
): Promise<boolean> {
  const record = await prisma.twoFactorCredential.findUnique({ where: { userId } });
  if (!record) return false;
  const secretBase32 = decryptSecret(record.secretEncrypted, encryptionKey);
  const totp = buildTotp(secretBase32, email);
  const delta = totp.validate({ token: code.replace(/\s+/g, ""), window: 1 });
  return delta !== null;
}

export async function enableTotp(prisma: PrismaClient, userId: string): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => randomToken(10).toUpperCase());
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.twoFactorCredential.update({ where: { userId }, data: { enabled: true, confirmedAt: new Date() } });
    await tx.recoveryCode.deleteMany({ where: { userId } });
    await tx.recoveryCode.createMany({
      data: codes.map((code) => ({ id: ulid(), userId, codeHash: sha256Hex(code) })),
    });
  });
  return codes; // shown to the user exactly once by the route handler
}

export async function disableTotp(prisma: PrismaClient, userId: string) {
  await prisma.$transaction([
    prisma.twoFactorCredential.deleteMany({ where: { userId } }),
    prisma.recoveryCode.deleteMany({ where: { userId } }),
  ]);
}

export async function consumeRecoveryCode(prisma: PrismaClient, userId: string, code: string): Promise<boolean> {
  const hash = sha256Hex(code.trim().toUpperCase());
  const record = await prisma.recoveryCode.findFirst({ where: { userId, codeHash: hash, usedAt: null } });
  if (!record) return false;
  const result = await prisma.recoveryCode.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
  return result.count === 1;
}
