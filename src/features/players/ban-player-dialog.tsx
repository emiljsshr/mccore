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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "@/lib/icons";
import { banPlayer } from "@/services";


interface BanPlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: string;
  username: string;
}

export function BanPlayerDialog({ open, onOpenChange, playerId, username }: BanPlayerDialogProps) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function handleBan() {
    setPending(true);
    try {
      await banPlayer(playerId, reason || "No reason provided.", "");
      toast.success(`${username} was banned`);
      onOpenChange(false);
      setReason("");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ban {username}?</DialogTitle>
          <DialogDescription>
            This immediately removes {username} from the server and prevents them from rejoining until
            unbanned.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="ban-reason">Reason</Label>
          <Textarea
            id="ban-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe why this player is being banned..."
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleBan} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Ban Player
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
