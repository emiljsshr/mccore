"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useServer } from "@/hooks/use-server";
import { ServerConsoleView } from "@/features/servers/console/console-view";
import { ServerChatPanel } from "@/features/servers/console/chat-panel";

export default function ServerConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const server = useServer(id);

  if (!server) notFound();

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="h-[calc(100dvh-18rem)] min-h-[420px] lg:col-span-2">
        <ServerConsoleView serverId={server.id} />
      </div>
      <div className="h-[calc(100dvh-18rem)] min-h-[420px]">
        <ServerChatPanel serverId={server.id} />
      </div>
    </div>
  );
}
