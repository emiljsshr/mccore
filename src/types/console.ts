export type LogLevel = "INFO" | "WARN" | "ERROR" | "CHAT" | "COMMAND";

export interface ConsoleLine {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
}
