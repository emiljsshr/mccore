"use client";

import { useEffect, useState } from "react";
import { useSessionStore } from "@/stores/use-session-store";


function getGreeting(hour: number) {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function DashboardGreeting() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const firstName = useSessionStore(s => s.user?.name.split(" ")[0] ?? "");

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {getGreeting(now.getHours())}, {firstName}.
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s an overview of your Minecraft infrastructure.
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">{formatDate(now)}</p>
        <p className="text-xl font-bold tabular-nums text-foreground">{formatTime(now)}</p>
      </div>
    </div>
  );
}
