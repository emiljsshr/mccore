"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CircleCheck, Loader2 } from "@/lib/icons";
import { api, mutation } from "@/lib/api";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setPending(true);
    try { await api("/auth/password-reset/request", mutation("POST", { email })); setSent(true); }
    catch(e) { setError((e as Error).message); } finally { setPending(false); }
  }

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-status-online-muted">
          <CircleCheck className="size-6 text-status-online" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Request received</h1>
          <p className="text-sm text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{email}</span>, contact your administrator for a password reset link.
          </p>
        </div>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/login">
            <ArrowLeft className="size-4" /> Back to Sign In
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Forgot password?</h1>
        <p className="text-sm text-muted-foreground">
          Enter the email address associated with your account and contact your administrator for a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="reset-email">Email</Label>
          <Input
            id="reset-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        {error && <p className="text-sm text-status-critical">{error}</p>}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Send Reset Link
        </Button>
      </form>

      <Link
        href="/login"
        className="flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to Sign In
      </Link>
    </div>
  );
}
