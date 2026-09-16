"use client";

import { toast } from "sonner";
import type { Server } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy } from "@/lib/icons";
import { useDataStore } from "@/stores/use-data-store";

interface PortAllocation {
  port: number;
  protocol: "TCP" | "UDP";
  label: string;
}

function getPortAllocations(server: Server): PortAllocation[] {
  const base: PortAllocation[] = [{ port: server.address.port, protocol: "TCP", label: "Minecraft" }];
  if (server.software === "paper" || server.software === "purpur") {
    base.push({ port: server.address.port + 10000, protocol: "TCP", label: "Dynmap" });
    base.push({ port: 19132, protocol: "UDP", label: "Geyser" });
  }
  return base;
}

function InfoRow({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {copyable ? (
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value);
            toast.success("Copied to clipboard");
          }}
          className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary"
        >
          <span className="font-mono">{value}</span>
          <Copy className="size-3" />
        </button>
      ) : (
        <span className="font-medium text-foreground">{value}</span>
      )}
    </div>
  );
}

export function ServerNetworkView({ server }: { server: Server }) {
  const mockNetworks = useDataStore(s => s.networks);
  const network = mockNetworks.find((n) => n.id === server.networkId);
  const allocations = getPortAllocations(server);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Connection</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <InfoRow
            label="Primary Address"
            value={server.address.domain ?? `${server.address.host}:${server.address.port}`}
            copyable
          />
          <InfoRow label="IP" value={server.address.host} copyable />
          <InfoRow label="Port" value={String(server.address.port)} />
          {server.address.domain && <InfoRow label="Domain" value={server.address.domain} copyable />}
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-muted-foreground">Proxy</span>
            <span className="font-medium text-foreground">{network ? network.name : "None"}</span>
          </div>
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-muted-foreground">Connection Status</span>
            <Badge
              className={
                server.status === "online"
                  ? "bg-status-online-muted text-status-online"
                  : "bg-status-unknown-muted text-status-unknown"
              }
            >
              {server.status === "online" ? "Reachable" : "Unreachable"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Port Allocations</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {allocations.map((alloc) => (
            <div key={`${alloc.port}-${alloc.protocol}`} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-mono font-medium text-foreground">
                  {alloc.port} <span className="text-xs text-muted-foreground">{alloc.protocol}</span>
                </p>
                <p className="text-xs text-muted-foreground">{alloc.label}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
