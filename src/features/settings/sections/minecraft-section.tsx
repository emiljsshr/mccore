"use client";

import { useEffect, useState } from "react";
import { api, mutation } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDataStore } from "@/stores/use-data-store";
import { SERVER_SOFTWARE_LABEL } from "@/types";
import type { MinecraftSoftware } from "@/types";

export function MinecraftSection() {
  const mockNodes = useDataStore(s => s.nodes);
  const [defaultSoftware, setDefaultSoftware] = useState<MinecraftSoftware>("paper");
  const [defaultMemory, setDefaultMemory] = useState("4");
  const [defaultNode, setDefaultNode] = useState(mockNodes[0]?.id ?? "");

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<{ settings: Record<string, unknown> }>("/settings").then(({ settings }) => {
      const defaults = settings.minecraftDefaults as { software?: MinecraftSoftware; memoryGb?: string; nodeId?: string } | undefined;
      if (defaults?.software) setDefaultSoftware(defaults.software);
      if (defaults?.memoryGb) setDefaultMemory(defaults.memoryGb);
      if (defaults?.nodeId) setDefaultNode(defaults.nodeId);
      setLoading(false);
    }).catch(e => toast.error(e.message));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Minecraft Defaults</CardTitle>
        <CardDescription>Applied automatically when creating a new server.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Default Server Software</Label>
            <Select value={defaultSoftware} onValueChange={(v) => setDefaultSoftware(v as MinecraftSoftware)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SERVER_SOFTWARE_LABEL) as MinecraftSoftware[])
                  .filter((s) => ["paper", "purpur", "vanilla"].includes(s))
                  .map((software) => (
                    <SelectItem key={software} value={software}>
                      {SERVER_SOFTWARE_LABEL[software]}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Default Memory (GB)</Label>
            <Select value={defaultMemory} onValueChange={setDefaultMemory}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["2", "4", "6", "8", "12", "16"].map((gb) => (
                  <SelectItem key={gb} value={gb}>
                    {gb} GB
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Default Node</Label>
            <Select value={defaultNode} onValueChange={setDefaultNode}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mockNodes.map((node) => (
                  <SelectItem key={node.id} value={node.id}>
                    {node.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end">
          <Button disabled={loading} onClick={async () => { try { await api("/settings", mutation("PATCH", { minecraftDefaults: { software: defaultSoftware, memoryGb: defaultMemory, nodeId: defaultNode } })); toast.success("Defaults saved"); } catch(e) { toast.error((e as Error).message); } }}>Save Defaults</Button>
        </div>
      </CardContent>
    </Card>
  );
}
