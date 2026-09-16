"use client";

import { useEffect, useState } from "react";
import { Search, Loader2, TriangleAlert } from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { searchModrinth } from "@/services";
import type { ModrinthProjectTypeFilter, ModrinthSearchHit } from "@/types";
import { MarketplaceCard } from "@/features/marketplace/marketplace-card";
import { InstallToServerDialog } from "@/features/marketplace/install-to-server-dialog";
import { cn } from "@/lib/utils";

const TABS: { value: ModrinthProjectTypeFilter; label: string }[] = [
  { value: "plugin", label: "Plugins" },
  { value: "mod", label: "Mods" },
];

const PAGE_SIZE = 18;

export function MarketplaceView() {
  const [query, setQuery] = useState("");
  const [projectType, setProjectType] = useState<ModrinthProjectTypeFilter>("plugin");
  const [hits, setHits] = useState<ModrinthSearchHit[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [status, setStatus] = useState<"loading" | "loading-more" | "ready" | "error">("loading");
  const [selectedHit, setSelectedHit] = useState<ModrinthSearchHit | null>(null);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setStatus("loading");
      searchModrinth({ query, projectType, limit: PAGE_SIZE })
        .then((res) => {
          if (!active) return;
          setHits(res.hits);
          setTotalHits(res.total_hits);
          setStatus("ready");
        })
        .catch(() => {
          if (!active) return;
          setStatus("error");
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, projectType]);

  function loadMore() {
    setStatus("loading-more");
    searchModrinth({ query, projectType, limit: PAGE_SIZE, offset: hits.length })
      .then((res) => {
        setHits((prev) => [...prev, ...res.hits]);
        setTotalHits(res.total_hits);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`Search ${projectType === "plugin" ? "plugins" : "mods"} on Modrinth...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-1.5">
          {TABS.map((tab) => (
            <Button
              key={tab.value}
              size="sm"
              variant="outline"
              onClick={() => setProjectType(tab.value)}
              className={cn(
                "h-7 rounded-full px-3 text-xs",
                projectType === tab.value && "border-primary bg-primary/10 text-primary hover:bg-primary/10",
              )}
            >
              {tab.label}
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
      ) : hits.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          No {projectType === "plugin" ? "plugins" : "mods"} match &quot;{query}&quot;.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {hits.map((hit) => (
              <MarketplaceCard key={hit.project_id} hit={hit} onInstall={setSelectedHit} />
            ))}
          </div>

          {hits.length < totalHits && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={status === "loading-more"}>
                {status === "loading-more" && <Loader2 className="size-3.5 animate-spin" />}
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      <InstallToServerDialog hit={selectedHit} onOpenChange={(open) => !open && setSelectedHit(null)} />
    </div>
  );
}
