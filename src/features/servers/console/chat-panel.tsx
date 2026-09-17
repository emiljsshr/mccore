"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Send } from "@/lib/icons";
import { Terminal } from "@/components/shared/terminal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/shared/player-avatar";
import { subscribeLive } from "@/lib/live";
import { sendChatMessage } from "@/services";

interface ChatMessage {
  id: string;
  username: string;
  message: string;
}

/**
 * Lightweight live chat panel for the Console tab — mirrors in-game chat
 * (via the Bridge plugin's ChatListener/`server:<id>` live channel) and
 * lets an operator broadcast a message back into the game
 * (BroadcastCommand, `/mccorebridge broadcast`). No history endpoint: like
 * the console's own live feed, this only shows what arrives while the
 * panel is mounted.
 */
export function ServerChatPanel({ serverId }: { serverId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeLive(`server:${serverId}`, (event) => {
      if (event.type !== "chat.message") return;
      const payload = event.payload as { username: string; message: string };
      setMessages((prev) =>
        [...prev, { id: `${Date.now()}-${Math.random()}`, username: payload.username, message: payload.message }].slice(-200),
      );
    });
  }, [serverId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await sendChatMessage(serverId, trimmed);
      setDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <Terminal
      toolbar={
        <>
          <MessageSquare className="size-3.5 text-white/40" />
          <span className="text-xs font-medium text-white/70">Chat</span>
        </>
      }
      footer={
        <div className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder="Message the server..."
            disabled={sending}
            className="h-8 border-none bg-transparent text-xs text-white shadow-none placeholder:text-white/30 focus-visible:ring-0"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-white/60 hover:bg-white/10 hover:text-white"
            onClick={handleSend}
            disabled={sending || !draft.trim()}
          >
            <Send className="size-3.5" />
          </Button>
        </div>
      }
    >
      <div ref={scrollRef} className="h-full space-y-2 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-white/30">No chat messages yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex items-start gap-2">
              <PlayerAvatar seed={m.username} size="xs" />
              <div className="min-w-0">
                <span className="font-semibold text-sky-300">{m.username}</span>{" "}
                <span className="break-words text-white/80">{m.message}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </Terminal>
  );
}
