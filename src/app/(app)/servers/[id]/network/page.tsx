"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useServer } from "@/hooks/use-server";
import { ServerNetworkView } from "@/features/servers/network-view";

export default function ServerNetworkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const server = useServer(id);

  if (!server) notFound();

  return <ServerNetworkView server={server} />;
}
