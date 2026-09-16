import type { MinecraftSoftware } from "@/types";

export const SOFTWARE_VERSIONS: Record<MinecraftSoftware, string[]> = {
  paper: ["1.21.4", "1.21.1", "1.20.6", "1.20.4", "1.19.4"],
  purpur: ["1.21.4", "1.21.1", "1.20.6", "1.20.4"],
  vanilla: ["1.21.4", "1.21.1", "1.20.6", "1.20.4", "1.19.4"],
  fabric: ["1.21.4", "1.21.1", "1.20.6"],
  forge: ["1.21.1", "1.20.6", "1.20.1"],
  neoforge: ["1.21.4", "1.21.1", "1.20.6"],
  velocity: ["3.4.0", "3.3.0"],
};

export const SOFTWARE_DESCRIPTIONS: Record<MinecraftSoftware, string> = {
  paper: "High performance Bukkit fork with extensive plugin support.",
  purpur: "Fork of Paper with additional performance and gameplay features.",
  vanilla: "Official unmodified Minecraft server.",
  fabric: "Lightweight, modern modding toolchain.",
  forge: "The most widely used modding platform for Minecraft.",
  neoforge: "Community-driven continuation of Forge.",
  velocity: "Modern, high-performance Minecraft proxy server.",
};
