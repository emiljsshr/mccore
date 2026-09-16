import { z } from "zod";

export const VerifyBootstrapCodeSchema = z.object({
  code: z.string().min(1).max(128),
});

export const CompleteSetupSchema = z.object({
  code: z.string().min(1).max(128),
  name: z.string().trim().min(1).max(96),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(256),
});

export const LoginSchema = z.object({
  remember: z.boolean().default(true),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(256),
  totpCode: z.string().min(1).max(16).optional(),
  recoveryCode: z.string().min(1).max(32).optional(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(1).max(256),
});

export const RequestPasswordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const ConfirmPasswordResetSchema = z.object({
  token: z.string().min(1).max(256),
  newPassword: z.string().min(1).max(256),
});

export const VerifyTotpSchema = z.object({
  code: z.string().min(1).max(16),
});
