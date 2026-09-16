"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Server as ServerIcon } from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ServerStatusBadge } from "@/components/shared/server-status-badge";
import { ServerActions } from "@/components/shared/server-actions";
import { SoftwareIcon } from "@/components/shared/software-icon";
import { ServerBlockIcon } from "@/components/shared/server-block-icon";
import { useServerStore } from "@/stores/use-server-store";
import { serverColumns } from "@/features/servers/columns";
import { formatMemory } from "@/lib/format";
import type { ServerStatus } from "@/types";
import { SERVER_SOFTWARE_LABEL } from "@/types";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

type FilterTab = "all" | Extract<ServerStatus, "online" | "offline" | "starting" | "stopping" | "error">;

const FILTERS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "starting", label: "Starting" },
  { value: "stopping", label: "Stopping" },
  { value: "error", label: "Error" },
];

export function ServerList() {
  const servers = useServerStore((s) => s.servers);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const router = useRouter();

  const filtered = useMemo(() => {
    return servers.filter((s) => {
      const matchesFilter = filter === "all" || s.status === filter;
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [servers, filter, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap gap-1 rounded-md border border-border bg-surface p-0.5">
          {FILTERS.map((f) => (
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
            placeholder="Search servers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ServerIcon}
          title="No servers found"
          description="Try adjusting your filters or create a new Minecraft server to get started."
          action={
            <Button asChild size="sm">
              <Link href="/servers/new">Create Server</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="hidden lg:block">
            <DataTable
              columns={serverColumns}
              data={filtered}
              onRowClick={(server) => router.push(`/servers/${server.id}`)}
            />
          </div>

          <div className="space-y-2 lg:hidden">
            {filtered.map((server) => (
              <Link
                key={server.id}
                href={`/servers/${server.id}`}
                className="block rounded-xl border border-border bg-surface p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ServerBlockIcon serverId={server.id} icon={server.icon} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{server.name}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <SoftwareIcon software={server.software} className="size-3.5 text-[7px]" />
                        {SERVER_SOFTWARE_LABEL[server.software]} {server.minecraftVersion}
                      </p>
                    </div>
                  </div>
                  <div onClick={(e) => e.preventDefault()}>
                    <ServerActions server={server} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <ServerStatusBadge status={server.status} />
                  <span>
                    {server.players.online}/{server.players.max} players
                  </span>
                  <span>{formatMemory(server.resources.memoryUsedMb, server.resources.memoryMaxMb)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
