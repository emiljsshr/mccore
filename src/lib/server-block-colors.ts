import { hashStringToSeed } from "@/lib/seeded-random";

/** Two-tone gradients evoking Minecraft block textures without using real assets. */
const PALETTE = [
  "from-emerald-400 to-emerald-700", // grass / survival
  "from-zinc-400 to-zinc-600", // stone / lobby
  "from-fuchsia-400 to-purple-600", // creative
  "from-neutral-700 to-neutral-950", // obsidian / development
  "from-amber-400 to-orange-600", // minigames
  "from-indigo-500 to-violet-700", // proxy / network
  "from-sky-400 to-blue-600",
  "from-rose-400 to-red-600",
];

const KNOWN: Record<string, number> = {
  "srv-survival": 0,
  "srv-lobby": 1,
  "srv-creative": 2,
  "srv-development": 3,
  "srv-minigames": 4,
  "srv-proxy": 5,
};

export function getServerBlockGradient(serverId: string): string {
  if (serverId in KNOWN) return PALETTE[KNOWN[serverId]];
  const index = Math.abs(hashStringToSeed(serverId)) % PALETTE.length;
  return PALETTE[index];
}
