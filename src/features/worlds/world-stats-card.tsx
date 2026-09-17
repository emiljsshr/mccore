"use client";

import { useEffect, useState } from "react";
import { Activity, Box, RefreshCw } from "@/lib/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getWorldStats } from "@/services";
import type { WorldStatsEntry } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Live per-world chunk/entity counts via the mcCore Bridge plugin
 * (`/mccorebridge worldstats`) — fetched on mount and on demand, never
 * polled continuously, since it's a live round trip to the running server
 * rather than a cached value.
 */
export function WorldStatsCard({ serverId }: { serverId: string }) {
  const [stats, setStats] = useState<WorldStatsEntry[] | null>(null);
  // Starts true: the mount effect below always kicks off a fetch, and (per
  // the "no setState synchronously within an effect" rule) only sets it
  // back to false from inside a .then/.catch/.finally callback, never true.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function fetchStats() {
    return getWorldStats(serverId)
      .then((data) => {
        setStats(data);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load world stats."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId]);

  function handleRefresh() {
    setLoading(true);
    fetchStats();
  }

  return (
    <Card className="gap-3 p-4">
      <CardHeader className="flex-row items-center justify-between gap-2 p-0">
        <CardTitle className="text-sm font-medium">World Stats</CardTitle>
        <Button variant="ghost" size="icon-sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading && !stats ? (
          <Skeleton className="h-20 w-full" />
        ) : error ? (
          <p className="text-xs text-status-critical">{error}</p>
        ) : !stats || stats.length === 0 ? (
          <p className="text-xs text-muted-foreground">No worlds loaded.</p>
        ) : (
          <div className="space-y-2">
            {stats.map((w) => (
              <div key={w.name} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs">
                <span className="font-medium text-foreground">{w.name}</span>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Box className="size-3.5" />
                    {w.loadedChunks} chunks
                  </span>
                  <span className="flex items-center gap-1">
                    <Activity className="size-3.5" />
                    {w.entityCount} entities
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
