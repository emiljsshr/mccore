"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useUiStore } from "@/stores/use-ui-store";
import { useServerStore } from "@/stores/use-server-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { cn } from "@/lib/utils";
import { SERVER_STATUS_VISUALS } from "@/lib/status-config";
import { SERVER_SOFTWARE_LABEL } from "@/types";
import type { Server } from "@/types";
import { ServerBlockIcon } from "@/components/shared/server-block-icon";
import { PlayerAvatar } from "@/components/shared/player-avatar";
import {
  ArrowLeft,
  Box,
  CirclePlus,
  HardDrive,
  LayoutDashboard,
  Network,
  RotateCw,
  Server as ServerIcon,
  Settings,
  Users,
  Gamepad2,
  CalendarClock,
  Archive,
  Activity,
} from "@/lib/icons";
import { toast } from "sonner";
import { restartServer } from "@/services";

type Mode = "root" | "restart";

export function CommandPalette() {
  const mockPlayers = usePlayerStore(s => s.players);
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const router = useRouter();
  const servers = useServerStore((s) => s.servers);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<Mode>("root");

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setSearch("");
      setMode("root");
    }
  }

  function go(href: string) {
    router.push(href);
    setOpen(false);
  }

  function backToRoot() {
    setMode("root");
    setSearch("");
  }

  function handleRestart(server: Server) {
    setOpen(false);
    setMode("root");
    toast.promise(restartServer(server.id), {
      loading: `Restarting ${server.name}...`,
      success: `${server.name} restarted`,
      error: "Failed to restart server",
    });
  }

  const filteredServers = useMemo(
    () => servers.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())),
    [servers, search],
  );

  const filteredPlayers = useMemo(
    () =>
      search.trim().length === 0
        ? []
        : mockPlayers.filter((p) => p.username.toLowerCase().includes(search.toLowerCase())).slice(0, 5),
    [search, mockPlayers],
  );

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        placeholder={mode === "restart" ? "Select a server to restart..." : "Search servers, players, plugins, settings..."}
        value={search}
        onValueChange={setSearch}
        onKeyDown={(e) => {
          if (mode === "restart" && (e.key === "Escape" || (e.key === "Backspace" && search === ""))) {
            e.preventDefault();
            backToRoot();
          }
        }}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {mode === "restart" ? (
          <CommandGroup heading="Restart which server?">
            <CommandItem onSelect={backToRoot} className="text-muted-foreground">
              <ArrowLeft /> Back
            </CommandItem>
            {filteredServers.map((server) => (
              <ServerResultItem key={server.id} server={server} onSelect={() => handleRestart(server)} />
            ))}
          </CommandGroup>
        ) : (
          <>
            <CommandGroup heading="Quick Actions">
              <CommandItem onSelect={() => go("/servers/new")}>
                <CirclePlus /> Create Server
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setSearch("");
                  setMode("restart");
                }}
              >
                <RotateCw /> Restart Server
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Servers">
              {filteredServers.slice(0, 6).map((server) => (
                <ServerResultItem key={server.id} server={server} onSelect={() => go(`/servers/${server.id}`)} />
              ))}
            </CommandGroup>

            {filteredPlayers.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Players">
                  {filteredPlayers.map((player) => (
                    <CommandItem key={player.id} onSelect={() => go("/players")}>
                      <PlayerAvatar seed={player.avatarSeed} size="xs" />
                      {player.username}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            <CommandSeparator />

            <CommandGroup heading="Navigate">
              <CommandItem onSelect={() => go("/dashboard")}>
                <LayoutDashboard /> Dashboard
              </CommandItem>
              <CommandItem onSelect={() => go("/servers")}>
                <ServerIcon /> All Servers
              </CommandItem>
              <CommandItem onSelect={() => go("/players")}>
                <Gamepad2 /> Players
              </CommandItem>
              <CommandItem onSelect={() => go("/plugins")}>
                <Box /> Plugins &amp; Mods
              </CommandItem>
              <CommandItem onSelect={() => go("/networks")}>
                <Network /> Networks
              </CommandItem>
              <CommandItem onSelect={() => go("/nodes")}>
                <HardDrive /> Nodes
              </CommandItem>
              <CommandItem onSelect={() => go("/users")}>
                <Users /> Users
              </CommandItem>
              <CommandItem onSelect={() => go("/schedules")}>
                <CalendarClock /> Schedules
              </CommandItem>
              <CommandItem onSelect={() => go("/backups")}>
                <Archive /> Backups
              </CommandItem>
              <CommandItem onSelect={() => go("/activity")}>
                <Activity /> Activity
              </CommandItem>
              <CommandItem onSelect={() => go("/settings")}>
                <Settings /> Settings
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

function ServerResultItem({ server, onSelect }: { server: Server; onSelect: () => void }) {
  const visual = SERVER_STATUS_VISUALS[server.status];
  return (
    <CommandItem onSelect={onSelect} className="items-center gap-3 py-2">
      <ServerBlockIcon serverId={server.id} icon={server.icon} size="sm" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{server.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {SERVER_SOFTWARE_LABEL[server.software]} · {server.players.online}/{server.players.max} online
        </span>
      </span>
      <span className={cn("ml-auto flex shrink-0 items-center gap-1.5 text-xs font-medium", visual.colorClass)}>
        <span
          className={cn("size-1.5 rounded-full", visual.dotClass, visual.animated && "animate-pulse-slow")}
          aria-hidden
        />
        {visual.label}
      </span>
    </CommandItem>
  );
}
