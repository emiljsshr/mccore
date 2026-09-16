import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Sign In — Cometa mcCore" };

export default function LoginPage() {
  return <LoginForm />;
}
