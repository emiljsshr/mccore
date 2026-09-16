import { cn } from "@/lib/utils";
import type { MinecraftSoftware } from "@/types";

const SOFTWARE_STYLE: Record<MinecraftSoftware, { letter: string; className: string }> = {
  paper: { letter: "P", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  purpur: { letter: "Pu", className: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  vanilla: { letter: "V", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  fabric: { letter: "F", className: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  forge: { letter: "Fo", className: "bg-red-500/15 text-red-600 dark:text-red-400" },
  neoforge: { letter: "N", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  velocity: { letter: "Ve", className: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400" },
};

interface SoftwareIconProps {
  software: MinecraftSoftware;
  className?: string;
}

export function SoftwareIcon({ software, className }: SoftwareIconProps) {
  const style = SOFTWARE_STYLE[software];
  return (
    <span
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded text-[9px] font-bold",
        style.className,
        className,
      )}
    >
      {style.letter}
    </span>
  );
}
