import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { PlayerList } from "@/features/players/player-list";

export const metadata: Metadata = { title: "Players — Cometa mcCore" };

export default function PlayersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Players"
        description="View and manage every player across your Minecraft servers."
      />
      <PlayerList />
    </div>
  );
}
