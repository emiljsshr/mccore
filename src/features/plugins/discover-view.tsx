"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Star, Download, ShieldCheck } from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listMarketplacePlugins } from "@/services/plugin-service";
import { toast } from "sonner";
import { PLUGIN_CATEGORY_LABEL } from "@/types";
import type { MarketplacePlugin, PluginCategory } from "@/types";
import { formatCompactNumber } from "@/lib/format";
import { InstallPluginDialog } from "@/features/plugins/install-plugin-dialog";
import { cn } from "@/lib/utils";
import { usePluginStore } from "@/stores/use-plugin-store";

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

export function PluginDiscoverView({ serverId, serverName }: { serverId: string; serverName: string }) {
  const [marketplacePlugins, setMarketplacePlugins] = useState<MarketplacePlugin[]>([]);
  useEffect(() => { let active = true; listMarketplacePlugins().then(items => { if (active) setMarketplacePlugins(items); }).catch(e => toast.error(e.message)); return () => { active = false; }; }, []);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<PluginCategory | "all">("all");
  const [selected, setSelected] = useState<MarketplacePlugin | null>(null);
  const installedPlugins = usePluginStore((s) => s.plugins);
  const installedNames = useMemo(
    () => new Set(installedPlugins.map((p) => p.name)),
    [installedPlugins],
  );

  const filtered = useMemo(() => {
    return marketplacePlugins.filter((p) => {
      const matchesCategory = category === "all" || p.category === category;
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [search, category, marketplacePlugins]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search plugins"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((plugin) => {
          const alreadyInstalled = installedNames.has(plugin.name);
          return (
            <div key={plugin.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary">
                  {plugin.iconLetter}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-foreground">{plugin.name}</p>
                    {plugin.verified && <ShieldCheck className="size-3.5 shrink-0 text-status-info" />}
                  </div>
                  <p className="text-xs text-muted-foreground">by {plugin.author}</p>
                </div>
              </div>

              <p className="line-clamp-2 flex-1 text-xs text-muted-foreground">{plugin.description}</p>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Download className="size-3" /> {formatCompactNumber(plugin.downloads)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Star className="size-3 fill-status-warning text-status-warning" /> {plugin.rating.toFixed(1)}
                </span>
              </div>

              <div className="flex flex-wrap gap-1">
                {plugin.supportedVersions.map((v) => (
                  <Badge key={v} variant="secondary" className="text-[10px]">
                    {v}
                  </Badge>
                ))}
              </div>

              <Button
                size="sm"
                variant={alreadyInstalled ? "outline" : "default"}
                disabled={alreadyInstalled}
                onClick={() => setSelected(plugin)}
              >
                {alreadyInstalled ? "Installed" : "Install"}
              </Button>
            </div>
          );
        })}
      </div>

      <InstallPluginDialog
        plugin={selected}
        serverId={serverId}
        serverName={serverName}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}
