import type { PrismaClient, Network as NetworkRow } from "@mccore/database";
import type { NetworkDto } from "@mccore/contracts";

export function toNetworkDto(network: NetworkRow, connectedServerIds: string[]): NetworkDto {
  return {
    id: network.id,
    name: network.name,
    description: network.description ?? undefined,
    proxyServerId: network.proxyServerId,
    connectedServerIds,
    createdAt: network.createdAt.toISOString(),
  };
}

export async function listNetworksWithConnections(prisma: PrismaClient): Promise<NetworkDto[]> {
  const networks: NetworkRow[] = await prisma.network.findMany({ orderBy: { createdAt: "asc" } });
  if (networks.length === 0) return [];

  const backends: Array<{ id: string; networkId: string | null }> = await prisma.minecraftServer.findMany({
    where: { networkId: { in: networks.map((n: NetworkRow) => n.id) }, deletedAt: null },
    select: { id: true, networkId: true },
  });
  const byNetwork = new Map<string, string[]>();
  for (const backend of backends) {
    if (!backend.networkId) continue;
    const list = byNetwork.get(backend.networkId) ?? [];
    list.push(backend.id);
    byNetwork.set(backend.networkId, list);
  }

  return networks.map((n: NetworkRow) => toNetworkDto(n, byNetwork.get(n.id) ?? []));
}

export async function getConnectedServerIds(prisma: PrismaClient, networkId: string): Promise<string[]> {
  const backends: Array<{ id: string }> = await prisma.minecraftServer.findMany({
    where: { networkId, deletedAt: null },
    select: { id: true },
  });
  return backends.map((b) => b.id);
}
