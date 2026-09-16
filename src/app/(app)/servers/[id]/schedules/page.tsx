"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useServer } from "@/hooks/use-server";
import { SchedulesView } from "@/features/schedules/schedules-view";

export default function ServerSchedulesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const server = useServer(id);

  if (!server) notFound();

  return <SchedulesView serverId={server.id} />;
}
