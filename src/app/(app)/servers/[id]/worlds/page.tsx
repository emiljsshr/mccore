"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useServer } from "@/hooks/use-server";
import { WorldsView } from "@/features/worlds/worlds-view";

export default function ServerWorldsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const server = useServer(id);

  if (!server) notFound();

  return <WorldsView serverId={server.id} />;
}
