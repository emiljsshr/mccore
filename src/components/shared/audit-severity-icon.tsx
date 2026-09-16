import { CircleAlert, CircleCheck, Info, TriangleAlert } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { AuditSeverity } from "@/types";

const SEVERITY_CONFIG: Record<AuditSeverity, { icon: typeof Info; className: string }> = {
  info: { icon: Info, className: "text-status-info" },
  success: { icon: CircleCheck, className: "text-status-online" },
  warning: { icon: TriangleAlert, className: "text-status-warning" },
  critical: { icon: CircleAlert, className: "text-status-critical" },
};

export function AuditSeverityIcon({
  severity,
  className,
}: {
  severity: AuditSeverity;
  className?: string;
}) {
  const config = SEVERITY_CONFIG[severity];
  const Icon = config.icon;
  return <Icon className={cn(config.className, className)} />;
}
