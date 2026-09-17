/**
 * Real Minecraft item textures, extracted from the official client jar by
 * PrismarineJS/minecraft-assets (https://github.com/PrismarineJS/minecraft-assets)
 * — an established, actively-maintained project already used across the
 * Minecraft tooling ecosystem — and served over jsDelivr's GitHub CDN.
 * Filenames match the vanilla item id directly (e.g. "diamond_sword.png"),
 * so no id-translation table is needed.
 */
const ASSET_VERSION = "26.1";

export function minecraftItemIconUrl(itemId: string): string {
  const name = itemId.replace(/^minecraft:/, "");
  return `https://cdn.jsdelivr.net/gh/PrismarineJS/minecraft-assets@master/data/${ASSET_VERSION}/items/${name}.png`;
}
