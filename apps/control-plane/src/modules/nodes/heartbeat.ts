import type { FastifyInstance } from "fastify";
import { ulid } from "@mccore/contracts";
import type { AgentHeartbeat } from "@mccore/contracts";

const METRIC_SAMPLE_INTERVAL_MS = 60_000; // §18/§19: don't persist every heartbeat, downsample to ~1/min
const lastMetricSampleAt = new Map<string, number>();

const DISK_DEGRADED_THRESHOLD = 0.9;

/** §18: derive Healthy/Degraded/Offline from heartbeat content, not just presence. */
function computeStatus(heartbeat: AgentHeartbeat): "HEALTHY" | "DEGRADED" {
  const diskUsageRatio = heartbeat.diskTotalMb > 0 ? heartbeat.diskUsedMb / heartbeat.diskTotalMb : 0;
  if (diskUsageRatio >= DISK_DEGRADED_THRESHOLD) return "DEGRADED";
  if (heartbeat.cpuUsagePercent >= 95) return "DEGRADED";
  return "HEALTHY";
}

export async function applyHeartbeat(app: FastifyInstance, frame: { kind: "heartbeat" } & AgentHeartbeat) {
  const status = computeStatus(frame);

  await app.prisma.node.update({
    where: { id: frame.nodeId },
    data: {
      status,
      agentVersion: frame.agentVersion,
      lastHeartbeatAt: new Date(),
      cpuUsagePercent: frame.cpuUsagePercent,
      memoryUsedMb: frame.memoryUsedMb,
      diskUsedMb: frame.diskUsedMb,
      loadAverage1m: frame.loadAverage1m,
      networkInMbps: frame.networkInMbps,
      networkOutMbps: frame.networkOutMbps,
      javaInstallations: frame.javaInstallations as never,
    },
  });

  app.liveHub.broadcast(`node:${frame.nodeId}`, "node.status", frame.nodeId, { status: status.toLowerCase() });
  app.liveHub.broadcast(`node:${frame.nodeId}`, "node.metrics", frame.nodeId, {
    cpuUsagePercent: frame.cpuUsagePercent,
    memoryUsedGb: frame.memoryUsedMb / 1024,
    memoryTotalGb: frame.memoryTotalMb / 1024,
    diskUsedGb: frame.diskUsedMb / 1024,
    diskTotalGb: frame.diskTotalMb / 1024,
    networkInMbps: frame.networkInMbps,
    networkOutMbps: frame.networkOutMbps,
  });

  const last = lastMetricSampleAt.get(frame.nodeId) ?? 0;
  if (Date.now() - last >= METRIC_SAMPLE_INTERVAL_MS) {
    lastMetricSampleAt.set(frame.nodeId, Date.now());
    await app.prisma.nodeMetric.create({
      data: {
        id: ulid(),
        nodeId: frame.nodeId,
        cpuUsagePercent: frame.cpuUsagePercent,
        memoryUsedMb: frame.memoryUsedMb,
        diskUsedMb: frame.diskUsedMb,
        loadAverage1m: frame.loadAverage1m,
        networkInMbps: frame.networkInMbps,
        networkOutMbps: frame.networkOutMbps,
      },
    });
  }

  // Reconcile which servers this node reports as running — catches drift
  // if a Control Plane restart missed status-changing events.
  if (frame.runningServerIds.length >= 0) {
    const servers = await app.prisma.minecraftServer.findMany({
      where: { nodeId: frame.nodeId, deletedAt: null },
      select: { id: true, status: true },
    });
    const knownIds = new Set(servers.map((server) => server.id));
    for (const server of servers) {
      const isRunning = frame.runningServerIds.includes(server.id);
      const driftedOnline = !isRunning && server.status === "ONLINE";
      const driftedOffline = isRunning && server.status === "OFFLINE";
      if (driftedOnline) {
        await app.prisma.minecraftServer.update({ where: { id: server.id }, data: { status: "CRASHED" } });
        app.liveHub.broadcast(`server:${server.id}`, "server.status", server.id, { status: "crashed", message: "Server process is no longer running." });
      } else if (driftedOffline) {
        await app.prisma.minecraftServer.update({ where: { id: server.id }, data: { status: "ONLINE" } });
        app.liveHub.broadcast(`server:${server.id}`, "server.status", server.id, { status: "online" });
      }
    }

    // A server whose delete command never reached the agent (disconnected
    // at the time, or lost in a race with a concurrent stop/restart) is
    // soft-deleted here and so permanently excluded from the loop above —
    // without this it keeps its port bound forever with no way to retry
    // from the dashboard, since the deleted row no longer shows there.
    const orphanedIds = frame.runningServerIds.filter((id) => !knownIds.has(id));
    if (orphanedIds.length > 0) {
      const deletedButRunning = await app.prisma.minecraftServer.findMany({
        where: { id: { in: orphanedIds }, nodeId: frame.nodeId, deletedAt: { not: null } },
        select: { id: true },
      });
      for (const server of deletedButRunning) {
        await app.agentHub
          .sendCommand(frame.nodeId, {
            commandId: ulid(),
            type: "server.kill",
            issuedAt: new Date().toISOString(),
            payload: { serverId: server.id },
          })
          .catch((err) => app.log.warn({ err, serverId: server.id }, "orphan server.kill command failed"));
      }
    }
  }
}
