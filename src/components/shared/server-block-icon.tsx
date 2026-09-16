import { cn } from "@/lib/utils";
import { getServerBlockGradient } from "@/lib/server-block-colors";
import { getServerIcon } from "@/lib/server-icon-registry";

const SIZE_CLASSES = {
  sm: "size-8",
  md: "size-10",
  lg: "size-14",
};

const ICON_SIZE_CLASSES = {
  sm: "size-4",
  md: "size-5",
  lg: "size-7",
};

interface ServerBlockIconProps {
  serverId: string;
  icon?: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

export function ServerBlockIcon({ serverId, icon, size = "md", className }: ServerBlockIconProps) {
  const gradient = getServerBlockGradient(serverId);
  // Resolves a stable, pre-created icon component from a lookup map — safe
  // despite going through a function call the compiler can't see into.
  const Icon = getServerIcon(icon);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-inner ring-1 ring-inset ring-white/10",
        gradient,
        SIZE_CLASSES[size],
        className,
      )}
      aria-hidden
    >
      {/* eslint-disable-next-line react-hooks/static-components -- see note above */}
      <Icon className={cn(ICON_SIZE_CLASSES[size], "drop-shadow-sm")} stroke={2} />
    </span>
  );
}
