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
import { messagePlayer } from "@/services";

interface MessagePlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: string;
  username: string;
}

const MAX_MESSAGE_LENGTH = 256;

export function MessagePlayerDialog({ open, onOpenChange, playerId, username }: MessagePlayerDialogProps) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSend() {
    if (!message.trim()) {
      toast.error("Enter a message first.");
      return;
    }
    setPending(true);
    try {
      await messagePlayer(playerId, message);
      toast.success(`Message sent to ${username}`);
      onOpenChange(false);
      setMessage("");
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
          <DialogTitle>Message {username}</DialogTitle>
          <DialogDescription>Sends a private in-game message only {username} can see.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="player-message">Message</Label>
          <Textarea
            id="player-message"
            value={message}
            onChange={(e) => setMessage(e.target.value.replace(/[\r\n]/g, ""))}
            placeholder="Type a message..."
            rows={3}
            maxLength={MAX_MESSAGE_LENGTH}
            autoFocus
          />
          <p className="text-right text-xs text-muted-foreground">
            {message.length}/{MAX_MESSAGE_LENGTH}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
