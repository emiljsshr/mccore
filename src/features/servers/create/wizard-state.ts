import type { Difficulty, GameMode, MinecraftSoftware } from "@/types";
import { DEFAULT_SERVER_ICON } from "@/lib/server-icon-registry";

export interface WizardState {
  name: string;
  description: string;
  icon: string;
  software: MinecraftSoftware;
  minecraftVersion: string;
  memoryMinGb: number;
  memoryMaxGb: number;
  cpuLimitPercent: number;
  diskLimitGb: number;
  nodeId: string;
  port: number;
  maxPlayers: number;
  gameMode: GameMode;
  difficulty: Difficulty;
  onlineMode: boolean;
  whitelist: boolean;
  pvp: boolean;
  commandBlocks: boolean;
}

export const DEFAULT_WIZARD_STATE: WizardState = {
  name: "",
  description: "",
  icon: DEFAULT_SERVER_ICON,
  software: "paper",
  minecraftVersion: "1.21.4",
  memoryMinGb: 2,
  memoryMaxGb: 4,
  cpuLimitPercent: 200,
  diskLimitGb: 10,
  nodeId: "",
  port: 25565,
  maxPlayers: 20,
  gameMode: "survival",
  difficulty: "normal",
  onlineMode: true,
  whitelist: false,
  pvp: true,
  commandBlocks: false,
};
