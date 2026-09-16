"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useServer } from "@/hooks/use-server";
import { ServerConsoleView } from "@/features/servers/console/console-view";

export default function ServerConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const server = useServer(id);

  if (!server) notFound();

  return (
    <div className="h-[calc(100dvh-18rem)] min-h-[420px]">
      <ServerConsoleView serverId={server.id} />
    </div>
  );
}
