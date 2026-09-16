import type { Difficulty, GameMode } from "./server";

export type WorldEnvironment = "overworld" | "nether" | "the_end";

export interface World {
  id: string;
  serverId: string;
  name: string;
  environment: WorldEnvironment;
  sizeMb: number;
  seed: string;
  difficulty: Difficulty;
  gameMode: GameMode;
  structures: boolean;
  hardcore: boolean;
  lastBackup?: string;
  generator: "default" | "flat" | "large_biomes" | "amplified" | "single_biome";
}
