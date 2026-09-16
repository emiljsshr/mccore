"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useServer } from "@/hooks/use-server";
import { ServerSettingsView } from "@/features/servers/server-settings-view";

export default function ServerSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const server = useServer(id);

  if (!server) notFound();

  return <ServerSettingsView server={server} />;
}
