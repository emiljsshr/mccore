export type ServerStatus =
  | "online"
  | "offline"
  | "starting"
  | "stopping"
  | "restarting"
  | "installing"
  | "crashed"
  | "error"
  | "suspended";

export type MinecraftSoftware =
  | "paper"
  | "purpur"
  | "vanilla"
  | "fabric"
  | "forge"
  | "neoforge"
  | "velocity";

export type GameMode = "survival" | "creative" | "adventure" | "spectator";

export type Difficulty = "peaceful" | "easy" | "normal" | "hard";

export interface ServerResources {
  cpuPercent: number;
  cpuLimitPercent: number;
  memoryUsedMb: number;
  memoryMaxMb: number;
  diskUsedMb: number;
  diskMaxMb: number;
}

export interface ServerPerformance {
  tps: number;
  mspt: number;
}

export interface ServerAddress {
  host: string;
  port: number;
  domain?: string;
}

export interface Server {
  id: string;
  name: string;
  description?: string;
  /** A Tabler icon key (its export name without the "Icon" prefix), e.g. "Trees". Resolved via `getServerIcon`. */
  icon: string;
  status: ServerStatus;
  software: MinecraftSoftware;
  minecraftVersion: string;
  build?: string;
  javaVersion: string;
  nodeId: string;
  networkId?: string;
  address: ServerAddress;
  players: {
    online: number;
    max: number;
  };
  resources: ServerResources;
  performance: ServerPerformance;
  uptimeSeconds: number;
  createdAt: string;
  lastStartedAt?: string;
  world: string;
  difficulty: Difficulty;
  gameMode: GameMode;
  onlineMode: boolean;
  whitelist: boolean;
  pvp: boolean;
  commandBlocks: boolean;
  motd?: string;
  tags?: string[];
}

export const SERVER_SOFTWARE_LABEL: Record<MinecraftSoftware, string> = {
  paper: "Paper",
  purpur: "Purpur",
  vanilla: "Vanilla",
  fabric: "Fabric",
  forge: "Forge",
  neoforge: "NeoForge",
  velocity: "Velocity",
};

export const SERVER_STATUS_LABEL: Record<ServerStatus, string> = {
  online: "Online",
  offline: "Offline",
  starting: "Starting",
  stopping: "Stopping",
  restarting: "Restarting",
  installing: "Installing",
  error: "Error",
  crashed: "Crashed",
  suspended: "Suspended",
};
