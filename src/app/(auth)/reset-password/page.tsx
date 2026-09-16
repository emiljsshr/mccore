"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, mutation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export default function ResetPasswordPage() {
  const router = useRouter(); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  return <form className="space-y-4" onSubmit={async e => { e.preventDefault(); setPending(true); try { const token = new URLSearchParams(window.location.search).get("token"); await api("/auth/password-reset/confirm", mutation("POST", { token, newPassword: password })); router.replace("/login"); } catch(e) { setError((e as Error).message); } finally { setPending(false); } }}><h1 className="text-xl font-semibold">Set your password</h1><Input aria-label="New password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} />{error && <p role="alert">{error}</p>}<Button disabled={pending}>Save Password</Button></form>;
}
