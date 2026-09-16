"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useDataStore } from "@/stores/use-data-store";
import { NodeDetailView } from "@/features/nodes/node-detail-view";

export default function NodeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const mockNodes = useDataStore(s => s.nodes);
  const { id } = use(params);
  const node = mockNodes.find((n) => n.id === id);

  if (!node) notFound();

  return <NodeDetailView node={node} />;
}
