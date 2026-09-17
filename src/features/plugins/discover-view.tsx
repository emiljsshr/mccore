"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Loader2, TriangleAlert } from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { searchModrinth } from "@/services/modrinth-service";
import { mapModrinthCategory } from "@/lib/modrinth-compat";
import { PLUGIN_CATEGORY_LABEL } from "@/types";
import type { ModrinthSearchHit, PluginCategory } from "@/types";
import { MarketplaceCard } from "@/features/marketplace/marketplace-card";
import { InstallPluginDialog } from "@/features/plugins/install-plugin-dialog";
import { cn } from "@/lib/utils";

const CATEGORIES: (PluginCategory | "all")[] = [
  "all",
  "administration",
  "world-management",
  "economy",
  "permissions",
  "performance",
  "chat",
  "protection",
  "utility",
];

const PAGE_SIZE = 18;

export function PluginDiscoverView({ serverId, serverName }: { serverId: string; serverName: string }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PluginCategory | "all">("all");
  const [hits, setHits] = useState<ModrinthSearchHit[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [status, setStatus] = useState<"loading" | "loading-more" | "ready" | "error">("loading");
  const [selectedHit, setSelectedHit] = useState<ModrinthSearchHit | null>(null);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setStatus("loading");
      searchModrinth({ query, projectType: "plugin", limit: PAGE_SIZE })
        .then((res) => {
          if (!active) return;
          setHits(res.hits);
          setTotalHits(res.total_hits);
          setStatus("ready");
        })
        .catch((e) => {
          if (!active) return;
          setStatus("error");
          toast.error(e.message);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  function loadMore() {
    setStatus("loading-more");
    searchModrinth({ query, projectType: "plugin", limit: PAGE_SIZE, offset: hits.length })
      .then((res) => {
        setHits((prev) => [...prev, ...res.hits]);
        setTotalHits(res.total_hits);
        setStatus("ready");
      })
      .catch((e) => {
        setStatus("error");
        toast.error(e.message);
      });
  }

  const filtered = useMemo(() => {
    if (category === "all") return hits;
    return hits.filter((hit) => mapModrinthCategory(hit.categories) === category);
  }, [hits, category]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search plugins on Modrinth..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <Button
              key={c}
              size="sm"
              variant="outline"
              onClick={() => setCategory(c)}
              className={cn(
                "h-7 rounded-full px-3 text-xs",
                category === c && "border-primary bg-primary/10 text-primary hover:bg-primary/10",
              )}
            >
              {c === "all" ? "All" : PLUGIN_CATEGORY_LABEL[c]}
            </Button>
          ))}
        </div>
      </div>

      {status === "loading" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : status === "error" ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          <TriangleAlert className="size-5 text-status-critical" />
          Couldn&apos;t reach Modrinth. Check your connection and try again.
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          No plugins match {query ? `"${query}"` : "this category"}.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((hit) => (
              <MarketplaceCard key={hit.project_id} hit={hit} onInstall={setSelectedHit} serverId={serverId} />
            ))}
          </div>

          {category === "all" && hits.length < totalHits && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={status === "loading-more"}>
                {status === "loading-more" && <Loader2 className="size-3.5 animate-spin" />}
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      <InstallPluginDialog
        hit={selectedHit}
        serverId={serverId}
        serverName={serverName}
        onOpenChange={(open) => !open && setSelectedHit(null)}
      />
    </div>
  );
}
