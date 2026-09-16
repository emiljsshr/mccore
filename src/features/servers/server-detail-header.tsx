"use client";

import type { Server } from "@/types";
import { SERVER_SOFTWARE_LABEL } from "@/types";
import { ServerStatusBadge } from "@/components/shared/server-status-badge";
import { ServerBlockIcon } from "@/components/shared/server-block-icon";
import { ServerActions } from "@/components/shared/server-actions";
import { Copy } from "@/lib/icons";
import { toast } from "sonner";

export function ServerDetailHeader({ server }: { server: Server }) {
  const address = server.address.domain ?? `${server.address.host}:${server.address.port}`;

  function copyAddress() {
    navigator.clipboard?.writeText(address);
    toast.success("Address copied to clipboard");
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <ServerBlockIcon serverId={server.id} icon={server.icon} size="lg" />
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">{server.name}</h1>
            <ServerStatusBadge status={server.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {SERVER_SOFTWARE_LABEL[server.software]} {server.minecraftVersion}
          </p>
          <button
            type="button"
            onClick={copyAddress}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Copy className="size-3" />
            <span className="font-mono">{address}</span>
          </button>
        </div>
      </div>

      <ServerActions server={server} variant="buttons" />
    </div>
  );
}
