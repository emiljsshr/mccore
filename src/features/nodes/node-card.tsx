import Link from "next/link";
import type { McNode } from "@/types";
import { Card } from "@/components/ui/card";
import { NODE_STATUS_VISUALS } from "@/lib/status-config";
import { HardDrive, MapPin, Server } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { formatDiskSize, formatPercent } from "@/lib/format";

function ProgressRow({ label, percent, display }: { label: string; percent: number; display: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-10 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", percent > 85 ? "bg-status-critical" : "bg-primary")}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <span className="w-24 shrink-0 text-right tabular-nums text-foreground">{display}</span>
    </div>
  );
}

export function NodeCard({ node }: { node: McNode }) {
  const visual = NODE_STATUS_VISUALS[node.status];
  const StatusIcon = visual.icon;

  return (
    <Link href={`/nodes/${node.id}`}>
      <Card className="gap-4 p-4 transition-colors hover:bg-hover">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HardDrive className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{node.name}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" />
                {node.location}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
              visual.bgClass,
              visual.colorClass,
            )}
          >
            <StatusIcon className="size-3" />
            {visual.label}
          </span>
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <ProgressRow label="CPU" percent={node.cpu.usagePercent} display={formatPercent(node.cpu.usagePercent)} />
          <ProgressRow
            label="RAM"
            percent={(node.memory.usedGb / node.memory.totalGb) * 100}
            display={formatDiskSize(node.memory.usedGb, node.memory.totalGb)}
          />
          <ProgressRow
            label="Disk"
            percent={(node.disk.usedGb / node.disk.totalGb) * 100}
            display={formatDiskSize(node.disk.usedGb, node.disk.totalGb)}
          />
        </div>

        <div className="flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
          <Server className="size-3.5" />
          {node.serverCount} server{node.serverCount === 1 ? "" : "s"} running
        </div>
      </Card>
    </Link>
  );
}
