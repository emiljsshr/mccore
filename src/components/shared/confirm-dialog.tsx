"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "@/lib/icons";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** When set, the user must type this exact value before confirming. */
  confirmationValue?: string;
  confirmationLabel?: string;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  confirmationValue,
  confirmationLabel,
  onConfirm,
}: ConfirmDialogProps) {
  const [typedValue, setTypedValue] = useState("");
  const [pending, setPending] = useState(false);

  const requiresTyping = Boolean(confirmationValue);
  const canConfirm = !requiresTyping || typedValue === confirmationValue;

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
      setTypedValue("");
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          onOpenChange(next);
          if (!next) setTypedValue("");
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {requiresTyping && (
          <div className="space-y-2 py-1">
            <Label htmlFor="confirm-input" className="text-xs text-muted-foreground">
              {confirmationLabel ?? `Type "${confirmationValue}" to confirm`}
            </Label>
            <Input
              id="confirm-input"
              autoComplete="off"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={confirmationValue}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant={destructive ? "destructive" : "default"}
              disabled={!canConfirm || pending}
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
