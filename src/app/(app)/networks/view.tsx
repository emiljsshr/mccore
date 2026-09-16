"use client";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { NetworkDiagram } from "@/features/networks/network-diagram";
import { useDataStore } from "@/stores/use-data-store";
import { EmptyState } from "@/components/shared/empty-state";
import { Network } from "@/lib/icons";


export default function NetworksPage() {
  const mockNetworks = useDataStore(s => s.networks);
  return (
    <div className="space-y-6">
      <PageHeader title="Networks" description="Velocity proxy networks connecting your servers." />

      {mockNetworks.length === 0 ? (
        <EmptyState icon={Network} title="No networks configured" description="Set up a Velocity proxy to connect multiple servers." />
      ) : (
        <div className="space-y-6">
          {mockNetworks.map((network) => (
            <Card key={network.id}>
              <CardHeader>
                <CardTitle className="text-sm font-medium">{network.name}</CardTitle>
                {network.description && <CardDescription>{network.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <NetworkDiagram network={network} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
