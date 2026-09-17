"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, UserX, ShieldCheck, MoreHorizontal, Loader2 } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EditUserDialog } from "@/features/users/edit-user-dialog";
import { useSessionStore } from "@/stores/use-session-store";
import { deleteUser, updateUser } from "@/services/user-service";
import type { PlatformUser } from "@/types";

interface UserActionsProps {
  user: PlatformUser;
  onDeleted?: () => void;
}

export function UserActions({ user, onDeleted }: UserActionsProps) {
  const currentUser = useSessionStore((s) => s.user);
  const isSelf = currentUser?.id === user.id;
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function run(fn: () => Promise<unknown>, successMessage: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(successMessage);
      } catch (e) {
        toast.error((e as Error).message || "Action failed. Please try again.");
      }
    });
  }

  const handleSuspend = () =>
    run(() => updateUser(user.id, { status: "suspended" }), `${user.name} was suspended`);
  const handleActivate = () =>
    run(() => updateUser(user.id, { status: "active" }), `${user.name} was reactivated`);
  const handleDelete = async () => {
    await deleteUser(user.id);
    toast.success(`${user.name} was deleted`);
    onDeleted?.();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" onClick={(e) => e.stopPropagation()}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
            <span className="sr-only">User actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          {user.status === "suspended" ? (
            <DropdownMenuItem onClick={handleActivate} disabled={isSelf || isPending}>
              <ShieldCheck /> Reactivate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={handleSuspend} disabled={isSelf || user.role === "owner" || isPending}>
              <UserX /> Suspend
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={isSelf}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditUserDialog user={user} open={editOpen} onOpenChange={setEditOpen} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${user.name}?`}
        description="This permanently removes their account and access to every server and node. This action cannot be undone."
        confirmLabel="Delete User"
        destructive
        confirmationValue={user.name}
        onConfirm={handleDelete}
      />
    </>
  );
}
