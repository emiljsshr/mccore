import type { Metadata } from "next";
import { SetupForm } from "@/features/auth/setup-form";

export const metadata: Metadata = { title: "Set Up Cometa mcCore" };

export default function SetupPage() {
  return <SetupForm />;
}
