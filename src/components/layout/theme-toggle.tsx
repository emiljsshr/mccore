"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useMounted } from "@/hooks/use-mounted";

const OPTIONS = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-surface p-0.5",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = mounted && theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-label={option.label}
            aria-pressed={active}
            onClick={() => setTheme(option.value)}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors",
              active && "bg-background text-foreground shadow-sm",
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
