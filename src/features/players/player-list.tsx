"use client";

import { useMemo, useState } from "react";
import { Search, Gamepad2 } from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PlayerDetailDrawer } from "@/features/players/player-detail-drawer";
import { fleetPlayerColumns } from "@/features/players/fleet-columns";
import { usePlayerStore } from "@/stores/use-player-store";
import { cn } from "@/lib/utils";
import type { Player } from "@/types";

type FilterTab = "all" | "online";

export function PlayerList() {
  const players = usePlayerStore((s) => s.players);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Player | null>(null);

  const onlineCount = useMemo(() => players.filter((p) => p.online).length, [players]);

  const filters: { value: FilterTab; label: string }[] = [
    { value: "all", label: `All (${players.length})` },
    { value: "online", label: `Online (${onlineCount})` },
  ];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return players.filter((p) => {
      const matchesFilter = filter === "all" || p.online;
      const matchesSearch = query.length === 0 || p.username.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [players, filter, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap gap-1 rounded-md border border-border bg-surface p-0.5">
          {filters.map((f) => (
            <Button
              key={f.value}
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setFilter(f.value)}
              className={cn(
                "h-7 rounded-sm px-2.5 text-xs font-medium text-muted-foreground",
                filter === f.value && "bg-background text-foreground shadow-sm",
              )}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Gamepad2}
          title="No players found"
          description={
            players.length === 0
              ? "Players will appear here once they join one of your servers."
              : "Try adjusting your search or filters."
          }
        />
      ) : (
        <DataTable columns={fleetPlayerColumns} data={filtered} onRowClick={setSelected} />
      )}

      <PlayerDetailDrawer player={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
