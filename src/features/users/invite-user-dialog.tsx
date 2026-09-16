"use client";

import { api, mutation } from "@/lib/api";
import { listUsers } from "@/services/user-service";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus } from "@/lib/icons";
import type { RoleName } from "@/types";
import { useDataStore } from "@/stores/use-data-store";

export function InviteUserDialog() {
  const mockRoles = useDataStore(s => s.roles);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [claimLink, setClaimLink] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleName>("viewer");

  async function handleInvite() {
    if (!email.trim()) {
      toast.error("Enter an email address first.");
      return;
    }
    setPending(true);
    try {
      const { claimToken } = await api<{ claimToken: string }>("/users", mutation("POST", { name, email, role }));
      setClaimLink(`${location.origin}/reset-password?token=${encodeURIComponent(claimToken)}`);
      await listUsers(); toast.success("Account invitation created");
    } catch(e) { toast.error((e as Error).message); } finally { setPending(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="size-4" /> Invite User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>Create an invitation link to share with your new user.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {claimLink && <div><p>Copy this invitation link now and share it privately:</p><Input readOnly value={claimLink} aria-label="Invitation link" /></div>}
          <div className="space-y-1.5"><Label htmlFor="invite-name">Name</Label><Input id="invite-name" value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as RoleName)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mockRoles.filter(r => r.name !== "owner").map((r) => (
                  <SelectItem key={r.id} value={r.name}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={pending || Boolean(claimLink)}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Create Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
