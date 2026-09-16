"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PluginInstalledView } from "@/features/plugins/installed-view";
import { PluginDiscoverView } from "@/features/plugins/discover-view";
import { PluginUpdatesView } from "@/features/plugins/updates-view";
import { usePluginStore } from "@/stores/use-plugin-store";

export function PluginManager({ serverId, serverName }: { serverId: string; serverName: string }) {
  const updateCount = usePluginStore(
    (s) => s.plugins.filter((p) => p.serverId === serverId && p.updateAvailable).length,
  );

  return (
    <Tabs defaultValue="installed">
      <TabsList>
        <TabsTrigger value="installed">Installed</TabsTrigger>
        <TabsTrigger value="discover">Discover</TabsTrigger>
        <TabsTrigger value="updates">
          Updates {updateCount > 0 && `(${updateCount})`}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="installed" className="mt-4">
        <PluginInstalledView serverId={serverId} />
      </TabsContent>
      <TabsContent value="discover" className="mt-4">
        <PluginDiscoverView serverId={serverId} serverName={serverName} />
      </TabsContent>
      <TabsContent value="updates" className="mt-4">
        <PluginUpdatesView />
      </TabsContent>
    </Tabs>
  );
}
