import { CircleCheck, CircleAlert, Ban } from "@/lib/icons";
import type { LucideIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { CompatLevel } from "@/lib/modrinth-compat";

const VISUALS: Record<CompatLevel, { label: string; icon: LucideIcon; className: string }> = {
  compatible: {
    label: "Compatible",
    icon: CircleCheck,
    className: "text-status-online bg-status-online-muted",
  },
  "version-mismatch": {
    label: "Version mismatch",
    icon: CircleAlert,
    className: "text-status-warning bg-status-warning-muted",
  },
  incompatible: {
    label: "Incompatible",
    icon: Ban,
    className: "text-status-critical bg-status-critical-muted",
  },
};

export function CompatibilityBadge({ level, className }: { level: CompatLevel; className?: string }) {
  const visual = VISUALS[level];
  const Icon = visual.icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        visual.className,
        className,
      )}
    >
      <Icon className="size-3" />
      {visual.label}
    </span>
  );
}
