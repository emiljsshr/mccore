import type { Server } from "@/types";
import { SERVER_SOFTWARE_LABEL } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export function ServerInfoPanel({ server }: { server: Server }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Server Information</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        <InfoRow label="Software" value={SERVER_SOFTWARE_LABEL[server.software]} />
        <InfoRow label="Minecraft" value={server.minecraftVersion} />
        <InfoRow label="Java" value={server.javaVersion} />
        <InfoRow label="Node" value={server.nodeId} />
        <InfoRow label="Port" value={String(server.address.port)} />
        <InfoRow label="World" value={server.world} />
        <InfoRow label="Difficulty" value={server.difficulty} />
        <InfoRow label="Game Mode" value={server.gameMode} />
      </CardContent>
    </Card>
  );
}
