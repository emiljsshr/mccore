"use client";

import { api, mutation } from "@/lib/api";
import { listRoles } from "@/services/user-service";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "@/lib/icons";
import type { PermissionGroup, Role } from "@/types";
import { PERMISSIONS, PERMISSION_GROUP_LABEL } from "@/types";

const GROUPS = Array.from(new Set(PERMISSIONS.map((p) => p.group))) as PermissionGroup[];

interface RoleEditorDialogProps {
  role: Role | null;
  onOpenChange: (open: boolean) => void;
}

export function RoleEditorDialog({ role, onOpenChange }: RoleEditorDialogProps) {
  const [permissionIds, setPermissionIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  if (role && initializedFor !== role.id) {
    setPermissionIds(new Set(role.permissionIds));
    setInitializedFor(role.id);
  }

  if (!role) return null;

  function toggle(id: string) {
    setPermissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setPending(true);
    try { await api(`/roles/${role?.id}`, mutation("PATCH", { permissionIds: [...permissionIds] })); await listRoles(); toast.success("Permissions updated"); onOpenChange(false); } catch(e) { toast.error((e as Error).message); } finally { setPending(false); }
  }

  return (
    <Dialog open={Boolean(role)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{role.label} Permissions</DialogTitle>
          <DialogDescription>{role.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {GROUPS.map((group) => (
            <div key={group} className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {PERMISSION_GROUP_LABEL[group]}
              </p>
              <div className="space-y-2 rounded-md border border-border p-3">
                {PERMISSIONS.filter((p) => p.group === group).map((permission) => (
                  <div key={permission.id} className="flex items-start gap-2.5">
                    <Checkbox
                      id={permission.id}
                      checked={permissionIds.has(permission.id)}
                      disabled={role.isSystem && role.name === "owner"}
                      onCheckedChange={() => toggle(permission.id)}
                    />
                    <div className="min-w-0">
                      <Label htmlFor={permission.id} className="font-normal">
                        {permission.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{permission.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending || (role.isSystem && role.name === "owner")}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
