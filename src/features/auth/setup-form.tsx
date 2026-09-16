"use client";

import { api, mutation } from "@/lib/api";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck } from "@/lib/icons";

export function SetupForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = password.length > 0 && password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Enter your name and email to continue.");
      return;
    }
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      await api("/setup/verify-code", mutation("POST", { code }));
      await api("/setup/complete", mutation("POST", { code, name, email, password }));
      toast.success("Cometa mcCore is ready"); router.push("/dashboard");
    } catch (e) { setError((e as Error).message); } finally { setPending(false); }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Badge variant="secondary" className="mb-1 gap-1.5">
          <ShieldCheck className="size-3" /> First-time setup
        </Badge>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Create your admin account</h1>
        <p className="text-sm text-muted-foreground">
          This account has full access to every server, node and user on this instance.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="setup-platform">Bootstrap Code</Label>
          <Input id="setup-platform" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" required />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="setup-name">Full Name</Label>
            <Input
              id="setup-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              autoComplete="name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="setup-email">Email</Label>
            <Input
              id="setup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="setup-password">Password</Label>
            <Input
              id="setup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 12 characters"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="setup-confirm">Confirm Password</Label>
            <Input
              id="setup-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              autoComplete="new-password"
            />
          </div>
        </div>

        {error && <p className="text-sm text-status-critical">{error}</p>}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Create Admin Account
        </Button>
      </form>
    </div>
  );
}
