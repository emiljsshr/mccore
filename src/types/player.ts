import type { GameMode } from "./server";

export interface PlayerPosition {
  x: number;
  y: number;
  z: number;
  world: string;
}

export interface InventoryItem {
  slot: number;
  itemId: string;
  name: string;
  count: number;
  iconUrl?: string;
  enchanted?: boolean;
}

export interface PlayerInventory {
  helmet?: InventoryItem;
  chestplate?: InventoryItem;
  leggings?: InventoryItem;
  boots?: InventoryItem;
  offhand?: InventoryItem;
  hotbar: (InventoryItem | undefined)[];
  main: (InventoryItem | undefined)[];
}

export interface PlayerAchievement {
  key: string;
  title: string;
  description: string;
  serverId: string;
  earnedAt: string;
}

export interface Player {
  id: string;
  uuid: string;
  username: string;
  avatarSeed: string;
  online: boolean;
  serverId?: string;
  position?: PlayerPosition;
  gameMode: GameMode;
  ping?: number;
  playtimeSeconds: number;
  firstJoined: string;
  lastSeen: string;
  banned: boolean;
  banReason?: string;
  bannedBy?: string;
  whitelisted: boolean;
  operator: boolean;
  inventory?: PlayerInventory;
  achievements: PlayerAchievement[];
}
