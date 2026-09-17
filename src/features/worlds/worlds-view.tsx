"use client";

import { useEffect, useState } from "react";
import { Globe } from "@/lib/icons";
import type { World } from "@/types";
import { listWorlds } from "@/services";
import { WorldCard } from "@/features/worlds/world-card";
import { WorldStatsCard } from "@/features/worlds/world-stats-card";
import { CreateWorldDialog } from "@/features/worlds/create-world-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export function WorldsView({ serverId }: { serverId: string }) {
  const [worlds, setWorlds] = useState<World[] | null>(null);

  useEffect(() => {
    let active = true;
    listWorlds(serverId).then((data) => {
      if (active) setWorlds(data);
    });
    return () => {
      active = false;
    };
  }, [serverId]);

  return (
    <div className="space-y-4">
      <WorldStatsCard serverId={serverId} />

      <div className="flex justify-end">
        <CreateWorldDialog
          serverId={serverId}
          onCreated={(world) => setWorlds((prev) => [world, ...(prev ?? [])])}
        />
      </div>

      {worlds === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : worlds.length === 0 ? (
        <EmptyState icon={Globe} title="No worlds yet" description="Create a world to get this server started." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {worlds.map((world) => (
            <WorldCard
              key={world.id}
              world={world}
              onRemoved={(id) => setWorlds((prev) => prev?.filter((w) => w.id !== id) ?? null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
