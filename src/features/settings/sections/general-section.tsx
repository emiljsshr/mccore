"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/stores/use-session-store";
import { api, mutation } from "@/lib/api";
import type { SessionUserDto } from "@mccore/contracts";

export function GeneralSection() {
  const user = useSessionStore(s => s.user);
  const [platformName, setPlatformName] = useState("Cometa mcCore");
  const [name, setName] = useState(user?.name ?? "");
  const [email] = useState(user?.email ?? "");

  useEffect(() => {
    api<{ settings: { platformName?: string } }>("/settings").then(({ settings }) => {
      if (settings.platformName) setPlatformName(settings.platformName);
    }).catch(e => toast.error(e.message));
  }, []);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Platform</CardTitle>
          <CardDescription>General information about your Cometa mcCore instance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="platform-name">Platform Name</Label>
            <Input id="platform-name" value={platformName} onChange={(e) => setPlatformName(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Account</CardTitle>
          <CardDescription>Your personal account details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="account-name">Name</Label>
            <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-email">Email</Label>
            <Input id="account-email" value={email} disabled />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={async () => { try { const { user } = await api<{ user: SessionUserDto }>("/auth/profile", mutation("PATCH", { name })); useSessionStore.setState({ user }); await api("/settings", mutation("PATCH", { platformName })); toast.success("Settings saved"); } catch(e) { toast.error((e as Error).message); } }}>Save Changes</Button>
      </div>
    </div>
  );
}
