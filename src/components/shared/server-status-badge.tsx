import { cn } from "@/lib/utils";
import { SERVER_STATUS_VISUALS } from "@/lib/status-config";
import type { ServerStatus } from "@/types";

interface ServerStatusBadgeProps {
  status: ServerStatus;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function ServerStatusBadge({
  status,
  className,
  showLabel = true,
  size = "sm",
}: ServerStatusBadgeProps) {
  const visual = SERVER_STATUS_VISUALS[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        visual.bgClass,
        visual.colorClass,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          visual.dotClass,
          visual.animated && "animate-pulse-slow",
        )}
        aria-hidden
      />
      {showLabel && visual.label}
    </span>
  );
}

export function ServerStatusDot({ status, className }: { status: ServerStatus; className?: string }) {
  const visual = SERVER_STATUS_VISUALS[status];
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        visual.dotClass,
        visual.animated && "animate-pulse-slow",
        className,
      )}
      role="img"
      aria-label={visual.label}
    />
  );
}
