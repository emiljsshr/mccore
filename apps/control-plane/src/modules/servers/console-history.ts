import type { FastifyInstance } from "fastify";
import { ConsoleLineDtoSchema, type ConsoleLineDto } from "@mccore/contracts";
const histories = new WeakMap<FastifyInstance["prisma"], Map<string, ConsoleLineDto[]>>();
export function rememberConsole(app: FastifyInstance, serverId: string, lines: unknown[]) {
  let servers = histories.get(app.prisma);
  if (!servers) { servers = new Map(); histories.set(app.prisma, servers); }
  const valid = lines.flatMap(line => { const parsed = ConsoleLineDtoSchema.safeParse(line); return parsed.success ? [parsed.data] : []; });
  servers.set(serverId, [...(servers.get(serverId) ?? []), ...valid].slice(-500));
}
export function consoleHistory(app: FastifyInstance, serverId: string) { return histories.get(app.prisma)?.get(serverId) ?? []; }
