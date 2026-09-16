"use client";
import { PageHeader } from "@/components/shared/page-header";
import { NodeCard } from "@/features/nodes/node-card";
import { useDataStore } from "@/stores/use-data-store";


export default function NodesPage() {
  const mockNodes = useDataStore(s => s.nodes);
  return (
    <div className="space-y-6">
      <PageHeader title="Nodes" description="Physical and virtual hosts running your Minecraft servers." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mockNodes.map((node) => (
          <NodeCard key={node.id} node={node} />
        ))}
      </div>
    </div>
  );
}
