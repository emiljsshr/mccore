"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useServer } from "@/hooks/use-server";
import { ServerDetailHeader } from "@/features/servers/server-detail-header";
import { ServerDetailTabs } from "@/features/servers/server-detail-tabs";

export default function ServerDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const server = useServer(id);

  if (!server) notFound();

  return (
    <div className="space-y-6">
      <ServerDetailHeader server={server} />
      <ServerDetailTabs serverId={server.id} />
      {children}
    </div>
  );
}
