"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoleEditorDialog } from "@/features/users/role-editor-dialog";
import { useDataStore } from "@/stores/use-data-store";
import type { Role } from "@/types";
import { Settings, Users } from "@/lib/icons";

export function RolesView() {
  const mockRoles = useDataStore(s => s.roles);
  const [editing, setEditing] = useState<Role | null>(null);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {mockRoles.map((role) => (
          <Card key={role.id} className="gap-2 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{role.label}</p>
              {role.isSystem && (
                <Badge variant="secondary" className="text-[10px]">
                  System
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{role.description}</p>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="size-3.5" />
                {role.memberCount} member{role.memberCount === 1 ? "" : "s"}
              </span>
              <Button variant="outline" size="sm" onClick={() => setEditing(role)}>
                <Settings className="size-3.5" /> Permissions
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <RoleEditorDialog role={editing} onOpenChange={(open) => !open && setEditing(null)} />
    </>
  );
}
