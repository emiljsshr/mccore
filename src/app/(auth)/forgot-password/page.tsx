import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset Password — Cometa mcCore" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
