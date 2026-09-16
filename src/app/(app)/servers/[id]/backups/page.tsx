"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useServer } from "@/hooks/use-server";
import { BackupsView } from "@/features/backups/backups-view";

export default function ServerBackupsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const server = useServer(id);

  if (!server) notFound();

  return <BackupsView serverId={server.id} />;
}
