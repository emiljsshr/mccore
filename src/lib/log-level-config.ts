import type { LogLevel } from "@/types";

export const LOG_LEVEL_CONFIG: Record<LogLevel, { label: string; className: string }> = {
  INFO: { label: "INFO", className: "text-slate-400" },
  WARN: { label: "WARN", className: "text-amber-400" },
  ERROR: { label: "ERROR", className: "text-red-400" },
  CHAT: { label: "CHAT", className: "text-sky-400" },
  COMMAND: { label: "CMD", className: "text-emerald-400" },
};

export const LOG_LEVELS: LogLevel[] = ["INFO", "WARN", "ERROR", "CHAT", "COMMAND"];
