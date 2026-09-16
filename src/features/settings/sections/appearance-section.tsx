"use client";

import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Monitor, Moon, Sun } from "@/lib/icons";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Theme</CardTitle>
        <CardDescription>Choose how Cometa mcCore looks on this device.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = mounted && theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border border-border bg-surface px-4 py-5 transition-colors hover:bg-hover",
                  active && "border-primary bg-primary/5",
                )}
              >
                <Icon className={cn("size-5", active ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-sm font-medium", active ? "text-primary" : "text-foreground")}>
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
