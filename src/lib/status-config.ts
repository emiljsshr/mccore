import type { ServerStatus } from "@/types";
import type { McNode, NodeStatus } from "@/types";
import {
  CircleCheck,
  CircleOff,
  CircleDashed,
  CircleAlert,
  Loader2,
  PauseCircle,
  Ban,
} from "@/lib/icons";
import type { LucideIcon } from "@/lib/icons";

export interface StatusVisual {
  label: string;
  icon: LucideIcon;
  colorClass: string;
  dotClass: string;
  bgClass: string;
  animated?: boolean;
}

export const SERVER_STATUS_VISUALS: Record<ServerStatus, StatusVisual> = {
  online: {
    label: "Online",
    icon: CircleCheck,
    colorClass: "text-status-online",
    dotClass: "bg-status-online",
    bgClass: "bg-status-online-muted",
  },
  offline: {
    label: "Offline",
    icon: CircleOff,
    colorClass: "text-status-unknown",
    dotClass: "bg-status-unknown",
    bgClass: "bg-status-unknown-muted",
  },
  starting: {
    label: "Starting",
    icon: Loader2,
    colorClass: "text-status-info",
    dotClass: "bg-status-info",
    bgClass: "bg-status-info-muted",
    animated: true,
  },
  stopping: {
    label: "Stopping",
    icon: Loader2,
    colorClass: "text-status-warning",
    dotClass: "bg-status-warning",
    bgClass: "bg-status-warning-muted",
    animated: true,
  },
  restarting: {
    label: "Restarting",
    icon: Loader2,
    colorClass: "text-status-info",
    dotClass: "bg-status-info",
    bgClass: "bg-status-info-muted",
    animated: true,
  },
  installing: {
    label: "Installing",
    icon: Loader2,
    colorClass: "text-status-info",
    dotClass: "bg-status-info",
    bgClass: "bg-status-info-muted",
    animated: true,
  },
  crashed: { label: "Crashed", icon: CircleAlert, colorClass: "text-status-critical", dotClass: "bg-status-critical", bgClass: "bg-status-critical-muted" },
  error: {
    label: "Error",
    icon: CircleAlert,
    colorClass: "text-status-critical",
    dotClass: "bg-status-critical",
    bgClass: "bg-status-critical-muted",
  },
  suspended: {
    label: "Suspended",
    icon: Ban,
    colorClass: "text-status-unknown",
    dotClass: "bg-status-unknown",
    bgClass: "bg-status-unknown-muted",
  },
};

export const NODE_STATUS_VISUALS: Record<NodeStatus, StatusVisual> = {
  healthy: {
    label: "Healthy",
    icon: CircleCheck,
    colorClass: "text-status-online",
    dotClass: "bg-status-online",
    bgClass: "bg-status-online-muted",
  },
  degraded: {
    label: "Degraded",
    icon: CircleAlert,
    colorClass: "text-status-warning",
    dotClass: "bg-status-warning",
    bgClass: "bg-status-warning-muted",
  },
  offline: {
    label: "Offline",
    icon: CircleDashed,
    colorClass: "text-status-critical",
    dotClass: "bg-status-critical",
    bgClass: "bg-status-critical-muted",
  },
};

export function isNodeHealthy(node: McNode) {
  return node.status === "healthy";
}

export const PAUSE_ICON = PauseCircle;
