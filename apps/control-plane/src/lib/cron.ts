import { CronExpressionParser } from "cron-parser";
import { ApiError, ErrorCode } from "@mccore/contracts";

export function computeNextRun(cronExpression: string, timezone: string, from: Date = new Date()): Date {
  try {
    const interval = CronExpressionParser.parse(cronExpression, { currentDate: from, tz: timezone });
    return interval.next().toDate();
  } catch (err) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, `Invalid cron expression or timezone: ${(err as Error).message}`);
  }
}
