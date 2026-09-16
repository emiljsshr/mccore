export type ScheduleAction =
  | "restart"
  | "stop"
  | "start"
  | "backup"
  | "command"
  | "message";

export interface Schedule {
  id: string;
  serverId: string;
  name: string;
  action: ScheduleAction;
  commandPayload?: string;
  scheduleDescription: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  nextRun: string;
  lastRun?: string;
}

export const SCHEDULE_ACTION_LABEL: Record<ScheduleAction, string> = {
  restart: "Restart Server",
  stop: "Stop Server",
  start: "Start Server",
  backup: "Create Backup",
  command: "Run Command",
  message: "Broadcast Message",
};
