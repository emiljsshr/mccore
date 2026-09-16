import type { PrismaClient, Node as NodeRow } from "@mccore/database";
import type { NodeDto } from "@mccore/contracts";

export function toNodeDto(node: NodeRow & { serverCount?: number }): NodeDto {
  return {
    id: node.id,
    name: node.name,
    location: node.location,
    status: node.status.toLowerCase() as NodeDto["status"],
    ipAddress: node.ipAddress,
    os: node.os,
    kernel: node.kernel,
    arch: node.arch,
    cpu: { model: node.cpuModel, cores: node.cpuCores, usagePercent: node.cpuUsagePercent },
    memory: { usedGb: node.memoryUsedMb / 1024, totalGb: node.memoryTotalMb / 1024 },
    disk: { usedGb: node.diskUsedMb / 1024, totalGb: node.diskTotalMb / 1024 },
    network: { inMbps: node.networkInMbps, outMbps: node.networkOutMbps },
    javaVersions: Array.isArray(node.javaInstallations)
      ? (node.javaInstallations as Array<{ version: string }>).map((j) => j.version)
      : [],
    agentVersion: node.agentVersion,
    lastHeartbeat: node.lastHeartbeatAt?.toISOString() ?? node.createdAt.toISOString(),
    serverCount: node.serverCount ?? 0,
    isLocal: node.isLocal,
  };
}

export async function listNodesWithCounts(prisma: PrismaClient) {
  const nodes = await prisma.node.findMany({ orderBy: { createdAt: "asc" } });
  const counts = await prisma.minecraftServer.groupBy({ by: ["nodeId"], _count: { _all: true }, where: { deletedAt: null } });
  const countByNode = new Map(counts.map((c: { nodeId: string; _count: { _all: number } }) => [c.nodeId, c._count._all]));
  return nodes.map((n: NodeRow) => toNodeDto({ ...n, serverCount: countByNode.get(n.id) ?? 0 }));
}
