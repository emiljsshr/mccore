"use client";

import { useMemo, useState } from "react";
import { Search } from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlayerAvatar } from "@/components/shared/player-avatar";
import { AuditSeverityIcon } from "@/components/shared/audit-severity-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { useDataStore } from "@/stores/use-data-store";
import { useServerStore } from "@/stores/use-server-store";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AuditSeverity } from "@/types";
import { Activity as ActivityIcon } from "@/lib/icons";

const SEVERITY_BG: Record<AuditSeverity, string> = {
  info: "bg-status-info-muted",
  success: "bg-status-online-muted",
  warning: "bg-status-warning-muted",
  critical: "bg-status-critical-muted",
};

export function ActivityLog() {
  const mockActivity = useDataStore(s => s.activity);
  const mockUsers = useDataStore(s => s.users);
  const servers = useServerStore((s) => s.servers);
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [serverFilter, setServerFilter] = useState("all");

  const filtered = useMemo(() => {
    return mockActivity.filter((event) => {
      const matchesSearch = event.description.toLowerCase().includes(search.toLowerCase());
      const matchesUser = userFilter === "all" || event.actor.id === userFilter;
      const matchesServer = serverFilter === "all" || event.serverId === serverFilter;
      return matchesSearch && matchesUser && matchesServer;
    });
  }, [search, userFilter, serverFilter, mockActivity]);

  function serverName(id?: string) {
    return servers.find((s) => s.id === id)?.name;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search activity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="User" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {mockUsers.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={serverFilter} onValueChange={setServerFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Server" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Servers</SelectItem>
            {servers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ActivityIcon} title="No activity found" description="Try adjusting your filters." />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {filtered.map((event) => (
            <div key={event.id} className="flex items-start gap-3 px-4 py-3.5">
              {event.actor.isSystem ? (
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    SEVERITY_BG[event.severity],
                  )}
                >
                  <AuditSeverityIcon severity={event.severity} className="size-3.5" />
                </span>
              ) : (
                <PlayerAvatar seed={event.actor.avatarSeed} size="sm" square={false} />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{event.description}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatDateTime(event.timestamp)}</span>
                  {serverName(event.serverId) && (
                    <Badge variant="secondary" className="text-[10px]">
                      {serverName(event.serverId)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
