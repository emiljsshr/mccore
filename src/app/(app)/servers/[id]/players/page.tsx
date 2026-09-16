"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useServer } from "@/hooks/use-server";
import { PlayerManagement } from "@/features/players/player-management";

export default function ServerPlayersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const server = useServer(id);

  if (!server) notFound();

  return <PlayerManagement serverId={server.id} />;
}
