import type { FastifyInstance } from "fastify";
import { ulid } from "@mccore/contracts";
import type { AgentCommand } from "@mccore/contracts";
import { computeNextRun } from "../../lib/cron.js";
import { tryAcquireServerLock, releaseServerLock } from "../servers/service.js";
import { createOperation } from "../operations/service.js";
import { recordAudit } from "../audit/service.js";

const POLL_INTERVAL_MS = 15_000;

/**
 * §40/§72: runs in the Control Plane (not the Agent) so a single schedule
 * definition is authoritative regardless of which node its server lives
 * on. Execution locking is two-layered: a schedule can't run twice
 * concurrently (guarded by requiring no existing `RUNNING`
 * ScheduleExecution row before starting a new one) and a state-changing
 * action additionally takes the per-server operation lock so a schedule
 * can't collide with a user-initiated restart/backup/plugin update.
 */
export function registerScheduler(app: FastifyInstance) {
  const interval = setInterval(() => {
    void runDueSchedules(app).catch((err) => app.log.error({ err }, "scheduler tick failed"));
  }, POLL_INTERVAL_MS);
  interval.unref();
  app.addHook("onClose", () => clearInterval(interval));
}

async function runDueSchedules(app: FastifyInstance) {
  const due = await app.prisma.schedule.findMany({
    where: { enabled: true, nextRunAt: { lte: new Date() } },
    include: { server: true },
  });

  for (const schedule of due) {
    // Advance nextRunAt immediately so a slow or failing execution can't
    // cause the same schedule to be picked up again on the next poll tick.
    const nextRunAt = computeNextRun(schedule.cronExpression, schedule.timezone, new Date(Date.now() + 1000));
    await app.prisma.schedule.update({ where: { id: schedule.id }, data: { nextRunAt } });

    const alreadyRunning = await app.prisma.scheduleExecution.findFirst({
      where: { scheduleId: schedule.id, status: "RUNNING" },
    });
    if (alreadyRunning) {
      app.log.warn({ scheduleId: schedule.id }, "skipping schedule tick — previous execution still running");
      continue;
    }

    const execution = await app.prisma.scheduleExecution.create({
      data: { id: ulid(), scheduleId: schedule.id, status: "RUNNING" },
    });

    void executeSchedule(app, schedule, execution.id).catch((err) =>
      app.log.error({ err, scheduleId: schedule.id }, "schedule execution failed unexpectedly")
    );
  }
}

async function executeSchedule(
  app: FastifyInstance,
  schedule: { id: string; serverId: string; name: string; action: string; commandPayload: string | null; server: { nodeId: string; status: string } },
  executionId: string
) {
  let message: string | undefined;
  let failed = false;

  try {
    if (!app.agentHub.isConnected(schedule.server.nodeId)) {
      throw new Error("Node is not connected.");
    }

    if (schedule.action === "start" || schedule.action === "stop" || schedule.action === "restart" || schedule.action === "backup") {
      const operation = await createOperation(app.prisma, { type: `SCHEDULED_${schedule.action.toUpperCase()}`, resourceId: schedule.serverId });
      const locked = await tryAcquireServerLock(app.prisma, schedule.serverId, operation.id);
      if (!locked) throw new Error("Server is busy with another operation.");
      try {
        await dispatchStateChangingAction(app, schedule);
      } finally {
        // Fast actions (start/stop/restart) release immediately since
        // their real completion is tracked by server.status events;
        // backup releases itself asynchronously via event-dispatcher.
        if (schedule.action !== "backup") await releaseServerLock(app.prisma, schedule.serverId);
      }
    } else if (schedule.action === "command") {
      await sendConsoleCommand(app, schedule.serverId, schedule.server.nodeId, schedule.commandPayload ?? "");
    } else if (schedule.action === "message") {
      const text = (schedule.commandPayload ?? "").replace(/[\r\n]/g, " ");
      await sendConsoleCommand(app, schedule.serverId, schedule.server.nodeId, `say ${text}`);
    }
  } catch (err) {
    failed = true;
    message = (err as Error).message;
  }

  await app.prisma.$transaction([
    app.prisma.scheduleExecution.update({
      where: { id: executionId },
      data: { status: failed ? "FAILED" : "SUCCEEDED", completedAt: new Date(), message },
    }),
    app.prisma.schedule.update({ where: { id: schedule.id }, data: { lastRunAt: new Date() } }),
  ]);

  if (failed) {
    await app.prisma.notification.create({
      data: {
        id: ulid(),
        type: "WARNING",
        title: "Schedule failed",
        message: `"${schedule.name}" could not run: ${message}`,
        serverId: schedule.serverId,
      },
    });
  }

  await recordAudit(app.prisma, {
    actorIsSystem: true,
    action: "schedule.executed",
    description: `Schedule "${schedule.name}" ran ${failed ? "and failed" : "successfully"}.`,
    targetType: "schedule",
    targetLabel: schedule.name,
    serverId: schedule.serverId,
    severity: failed ? "WARNING" : "SUCCESS",
  });
}

async function dispatchStateChangingAction(
  app: FastifyInstance,
  schedule: { serverId: string; action: string; server: { nodeId: string } }
) {
  const nodeId = schedule.server.nodeId;
  let command: AgentCommand;
  if (schedule.action === "start") {
    command = { commandId: ulid(), type: "server.start", issuedAt: new Date().toISOString(), payload: { serverId: schedule.serverId } };
  } else if (schedule.action === "stop") {
    command = { commandId: ulid(), type: "server.stop", issuedAt: new Date().toISOString(), payload: { serverId: schedule.serverId, gracePeriodSeconds: 30 } };
  } else if (schedule.action === "restart") {
    command = { commandId: ulid(), type: "server.restart", issuedAt: new Date().toISOString(), payload: { serverId: schedule.serverId, gracePeriodSeconds: 30 } };
  } else {
    const backupId = ulid();
    await app.prisma.backup.create({
      data: {
        id: backupId,
        serverId: schedule.serverId,
        name: `Scheduled backup ${new Date().toISOString()}`,
        type: "AUTOMATIC",
        status: "IN_PROGRESS",
        storageProvider: "local",
        storagePath: `${schedule.serverId}/${backupId}.tar.zst`,
        includesWorlds: true,
        includesPlugins: true,
        includesConfig: true,
        compression: "fast",
      },
    });
    command = {
      commandId: ulid(),
      type: "backup.create",
      issuedAt: new Date().toISOString(),
      payload: { serverId: schedule.serverId, backupId, includesWorlds: true, includesPlugins: true, includesConfig: true, compression: "fast" },
    };
  }
  const ack = await app.agentHub.sendCommand(nodeId, command);
  if (!ack.ok) throw new Error(ack.errorMessage ?? "Agent rejected the scheduled command.");
}

async function sendConsoleCommand(app: FastifyInstance, serverId: string, nodeId: string, command: string) {
  const ack = await app.agentHub.sendCommand(nodeId, {
    commandId: ulid(),
    type: "console.command",
    issuedAt: new Date().toISOString(),
    payload: { serverId, command },
  });
  if (!ack.ok) throw new Error(ack.errorMessage ?? "Agent rejected the console command.");
}
