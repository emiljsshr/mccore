"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "@/lib/icons";
import type { PlatformUser, RoleName } from "@/types";
import { useDataStore } from "@/stores/use-data-store";
import { useSessionStore } from "@/stores/use-session-store";
import { updateUser } from "@/services/user-service";

interface EditUserDialogProps {
  user: PlatformUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  const roles = useDataStore((s) => s.roles);
  const currentUser = useSessionStore((s) => s.user);
  const isSelf = currentUser?.id === user.id;
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<RoleName>(user.role);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  // Re-seed the form from the current user each time the dialog opens,
  // mirroring role-editor-dialog.tsx's pattern: a plain state update during
  // render instead of an effect, so it takes effect in the same render
  // instead of causing an extra one.
  if (open && initializedFor !== user.id) {
    setName(user.name);
    setRole(user.role);
    setInitializedFor(user.id);
  } else if (!open && initializedFor !== null) {
    setInitializedFor(null);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name can't be empty.");
      return;
    }
    setPending(true);
    try {
      await updateUser(user.id, {
        name: name.trim(),
        ...(isSelf ? {} : { role }),
      });
      toast.success("User updated");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {user.name}</DialogTitle>
          <DialogDescription>Update this user&apos;s name and role.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-user-name">Name</Label>
            <Input id="edit-user-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as RoleName)} disabled={isSelf}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles
                  .filter((r) => r.name !== "owner" || r.name === user.role)
                  .map((r) => (
                    <SelectItem key={r.id} value={r.name}>
                      {r.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {isSelf && (
              <p className="text-xs text-muted-foreground">You can&apos;t change your own role.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
