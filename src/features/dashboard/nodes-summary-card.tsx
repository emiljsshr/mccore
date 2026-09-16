"use client";
import Link from "next/link";
import { MapPin } from "@/lib/icons";
import { useDataStore } from "@/stores/use-data-store";
import { NODE_STATUS_VISUALS } from "@/lib/status-config";
import { cn } from "@/lib/utils";

function ProgressRow({ label, percent, display }: { label: string; percent: number; display: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-9 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", percent > 85 ? "bg-status-critical" : "bg-primary")}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right tabular-nums text-foreground">{display}</span>
    </div>
  );
}

export function NodesSummaryCard() {
  const mockNodes = useDataStore(s => s.nodes);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Nodes</h2>
        <Link href="/nodes" className="text-xs font-medium text-primary hover:underline">
          View All
        </Link>
      </div>
      <div className="space-y-4">
        {mockNodes.map((node) => {
          const visual = NODE_STATUS_VISUALS[node.status];
          const StatusIcon = visual.icon;
          return (
            <Link
              key={node.id}
              href={`/nodes/${node.id}`}
              className="block space-y-2 rounded-lg p-2 -m-2 transition-colors hover:bg-hover"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{node.name}</span>
                <span className={cn("inline-flex items-center gap-1 text-xs font-medium", visual.colorClass)}>
                  <StatusIcon className="size-3" />
                  {visual.label}
                </span>
              </div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" />
                {node.location}
              </p>
              <div className="space-y-1.5 pt-1">
                <ProgressRow label="CPU" percent={node.cpu.usagePercent} display={`${node.cpu.usagePercent}%`} />
                <ProgressRow
                  label="Disk"
                  percent={(node.disk.usedGb / node.disk.totalGb) * 100}
                  display={`${node.disk.usedGb} / ${node.disk.totalGb} GB`}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
