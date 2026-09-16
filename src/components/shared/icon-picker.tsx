"use client";

import { useEffect, useMemo, useState } from "react";
import type { TablerIcon } from "@tabler/icons-react";
import { Search, Loader2 } from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  FEATURED_SERVER_ICONS,
  getServerIcon,
  humanizeIconName,
  isCuratedServerIcon,
} from "@/lib/server-icon-registry";
import { getServerBlockGradient } from "@/lib/server-block-colors";

interface IconPickerProps {
  value: string;
  onChange: (iconKey: string) => void;
  /** Used only to preview the selected icon's color; purely cosmetic. */
  previewSeed?: string;
}

type FullIconSearch = typeof import("@/lib/server-icon-search");

const featuredResults = FEATURED_SERVER_ICONS.map((key) => ({
  key,
  label: humanizeIconName(key),
  Icon: getServerIcon(key),
}));

export function IconPicker({ value, onChange, previewSeed = value }: IconPickerProps) {
  const [query, setQuery] = useState("");
  const [fullSet, setFullSet] = useState<FullIconSearch | null>(null);
  const loading = Boolean(query.trim()) && !fullSet;

  // Load the full 6000+ icon search module lazily — either once the user
  // searches, or upfront if we need to resolve a previously-picked icon
  // that falls outside the curated fast-path set.
  useEffect(() => {
    if (fullSet || (!query.trim() && isCuratedServerIcon(value))) return;
    let active = true;
    import("@/lib/server-icon-search").then((mod) => {
      if (active) setFullSet(mod);
    });
    return () => {
      active = false;
    };
  }, [query, value, fullSet]);

  const results = useMemo(() => {
    if (!query.trim()) return featuredResults;
    if (!fullSet) return [];
    return fullSet.searchAllServerIcons(query);
  }, [query, fullSet]);

  const SelectedIcon: TablerIcon =
    isCuratedServerIcon(value) || !fullSet ? getServerIcon(value) : fullSet.getServerIconFromFullSet(value);
  const gradient = getServerBlockGradient(previewSeed);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-inner ring-1 ring-inset ring-white/10",
            gradient,
          )}
        >
          {/* eslint-disable-next-line react-hooks/static-components -- stable lookup, see note in server-icon-registry.ts */}
          <SelectedIcon className="size-6" stroke={2} />
        </span>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 6,000+ icons..."
            className="pl-8"
          />
        </div>
      </div>

      <div className="grid grid-cols-8 gap-1.5 rounded-lg border border-border bg-surface p-2 sm:grid-cols-10">
        {query.trim() && loading ? (
          <div className="col-span-full flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Loading icon set...
          </div>
        ) : results.length === 0 ? (
          <p className="col-span-full py-6 text-center text-xs text-muted-foreground">
            No icons match &quot;{query}&quot;.
          </p>
        ) : (
          results.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              title={label}
              onClick={() => onChange(key)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground",
                value === key && "bg-primary/15 text-primary hover:bg-primary/15 hover:text-primary",
              )}
            >
              <Icon className="size-4" stroke={2} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
