"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useServer } from "@/hooks/use-server";
import { FileBrowser } from "@/features/files/file-browser";

export default function ServerFilesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const server = useServer(id);

  if (!server) notFound();

  return <FileBrowser serverId={server.id} />;
}
