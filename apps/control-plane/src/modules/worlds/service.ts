import type { World } from "@mccore/database";
import type { WorldDto } from "@mccore/contracts";

export function toWorldDto(world: World): WorldDto {
  return {
    id: world.id,
    serverId: world.serverId,
    name: world.name,
    environment: world.environment as WorldDto["environment"],
    sizeMb: world.sizeMb,
    seed: world.seed,
    difficulty: world.difficulty.toLowerCase() as WorldDto["difficulty"],
    gameMode: world.gameMode.toLowerCase() as WorldDto["gameMode"],
    structures: world.structures,
    hardcore: world.hardcore,
    lastBackup: world.lastBackupAt?.toISOString() ?? undefined,
    generator: world.generator as WorldDto["generator"],
  };
}
