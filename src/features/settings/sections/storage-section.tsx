"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useDataStore } from "@/stores/use-data-store";

export function StorageSection() {
  const mockNodes = useDataStore(s => s.nodes);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Storage Usage</CardTitle>
        <CardDescription>Disk usage across all nodes in your infrastructure.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {mockNodes.map((node) => {
          const percent = Math.round((node.disk.usedGb / node.disk.totalGb) * 100);
          return (
            <div key={node.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{node.name}</span>
                <span className="text-muted-foreground">
                  {node.disk.usedGb} / {node.disk.totalGb} GB
                </span>
              </div>
              <Progress value={percent} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
