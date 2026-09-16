"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PlayerDetailDrawer } from "@/features/players/player-detail-drawer";
import {
  allPlayersColumns,
  bannedPlayerColumns,
  onlinePlayerColumns,
  operatorColumns,
  whitelistColumns,
} from "@/features/players/columns";
import { usePlayerStore } from "@/stores/use-player-store";
import { unbanPlayer, toggleWhitelist, toggleOperator } from "@/services";
import type { Player } from "@/types";
import { Users } from "@/lib/icons";

export function PlayerManagement({ serverId }: { serverId: string }) {
  const players = usePlayerStore((s) => s.players);
  const [selected, setSelected] = useState<Player | null>(null);

  const online = useMemo(
    () => players.filter((p) => p.online && p.serverId === serverId),
    [players, serverId],
  );
  const banned = useMemo(() => players.filter((p) => p.banned), [players]);
  const whitelisted = useMemo(() => players.filter((p) => p.whitelisted), [players]);
  const operators = useMemo(() => players.filter((p) => p.operator), [players]);

  async function handleUnban(player: Player) {
    await unbanPlayer(player.id);
    toast.success(`${player.username} was unbanned`);
  }

  async function handleRemoveWhitelist(player: Player) {
    await toggleWhitelist(player.id);
    toast.success(`${player.username} removed from whitelist`);
  }

  async function handleRevokeOp(player: Player) {
    await toggleOperator(player.id);
    toast.success(`${player.username} is no longer an operator`);
  }

  return (
    <>
      <Tabs defaultValue="online">
        <TabsList>
          <TabsTrigger value="online">Online ({online.length})</TabsTrigger>
          <TabsTrigger value="all">All Players ({players.length})</TabsTrigger>
          <TabsTrigger value="banned">Banned ({banned.length})</TabsTrigger>
          <TabsTrigger value="whitelist">Whitelist ({whitelisted.length})</TabsTrigger>
          <TabsTrigger value="operators">Operators ({operators.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="online" className="mt-4">
          {online.length === 0 ? (
            <EmptyState icon={Users} title="No players online" description="Players will appear here once they join this server." />
          ) : (
            <DataTable columns={onlinePlayerColumns} data={online} onRowClick={setSelected} />
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <DataTable columns={allPlayersColumns} data={players} onRowClick={setSelected} />
        </TabsContent>

        <TabsContent value="banned" className="mt-4">
          {banned.length === 0 ? (
            <EmptyState icon={Users} title="No banned players" description="Banned players will be listed here." />
          ) : (
            <DataTable
              columns={bannedPlayerColumns(handleUnban)}
              data={banned}
              onRowClick={setSelected}
            />
          )}
        </TabsContent>

        <TabsContent value="whitelist" className="mt-4">
          {whitelisted.length === 0 ? (
            <EmptyState icon={Users} title="Whitelist is empty" description="Add players to the whitelist to restrict access." />
          ) : (
            <DataTable
              columns={whitelistColumns(handleRemoveWhitelist)}
              data={whitelisted}
              onRowClick={setSelected}
            />
          )}
        </TabsContent>

        <TabsContent value="operators" className="mt-4">
          {operators.length === 0 ? (
            <EmptyState icon={Users} title="No operators" description="Grant operator status to trusted players." />
          ) : (
            <DataTable
              columns={operatorColumns(handleRevokeOp)}
              data={operators}
              onRowClick={setSelected}
            />
          )}
        </TabsContent>
      </Tabs>

      <PlayerDetailDrawer player={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </>
  );
}
