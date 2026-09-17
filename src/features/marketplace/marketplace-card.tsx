"use client";

import { useMemo, useState } from "react";
import { Download, Heart, Box } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { formatCompactNumber } from "@/lib/format";
import { useServerStore } from "@/stores/use-server-store";
import { checkCompatibility } from "@/lib/modrinth-compat";
import { CompatibilityBadge } from "@/features/marketplace/compatibility-badge";
import type { ModrinthSearchHit } from "@/types";
import { cn } from "@/lib/utils";

interface MarketplaceCardProps {
  hit: ModrinthSearchHit;
  onInstall: (hit: ModrinthSearchHit) => void;
  /** When set, shows compatibility with just this one server instead of a count across all of them. */
  serverId?: string;
}

export function MarketplaceCard({ hit, onInstall, serverId }: MarketplaceCardProps) {
  const [iconFailed, setIconFailed] = useState(false);
  const servers = useServerStore((s) => s.servers);
  const singleServer = serverId ? servers.find((s) => s.id === serverId) : undefined;

  const compatibleCount = useMemo(
    () => servers.filter((server) => checkCompatibility(hit, server).level === "compatible").length,
    [hit, servers],
  );
  const singleCompat = useMemo(
    () => (singleServer ? checkCompatibility(hit, singleServer) : null),
    [hit, singleServer],
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        {hit.icon_url && !iconFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Modrinth CDN icon, no remotePatterns config for next/image
          <img
            src={hit.icon_url}
            alt=""
            className="size-9 shrink-0 rounded-md object-cover"
            onError={() => setIconFailed(true)}
          />
        ) : (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Box className="size-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{hit.title}</p>
          <p className="truncate text-xs text-muted-foreground">by {hit.author}</p>
        </div>
      </div>

      <p className="line-clamp-2 flex-1 text-xs text-muted-foreground">{hit.description}</p>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Download className="size-3" /> {formatCompactNumber(hit.downloads)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Heart className="size-3" /> {formatCompactNumber(hit.follows)}
        </span>
      </div>

      {singleCompat ? (
        <CompatibilityBadge level={singleCompat.level} className="self-start" />
      ) : (
        <div
          className={cn(
            "rounded-md px-2 py-1 text-[11px] font-medium",
            compatibleCount > 0
              ? "bg-status-online-muted text-status-online"
              : "bg-status-critical-muted text-status-critical",
          )}
        >
          {compatibleCount > 0
            ? `Compatible with ${compatibleCount} of ${servers.length} of your servers`
            : "Not compatible with any of your servers"}
        </div>
      )}

      <Button size="sm" onClick={() => onInstall(hit)}>
        Install
      </Button>
    </div>
  );
}
