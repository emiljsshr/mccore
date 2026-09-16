"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useServer } from "@/hooks/use-server";
import { PluginManager } from "@/features/plugins/plugin-manager";

export default function ServerPluginsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const server = useServer(id);

  if (!server) notFound();

  return <PluginManager serverId={server.id} serverName={server.name} />;
}
