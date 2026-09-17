/**
 * Minecraft's "formatting codes" (https://minecraft.wiki/w/Formatting_codes):
 * a `§` followed by one hex-like character selects a color or a text style
 * for everything after it, until the next code or the end of the string.
 * Used for server.properties' motd — this is the actual protocol Minecraft
 * clients render, not a UI convention of our own.
 */

export const MOTD_COLOR_CODES = [
  { code: "0", label: "Black", hex: "#000000" },
  { code: "1", label: "Dark Blue", hex: "#0000AA" },
  { code: "2", label: "Dark Green", hex: "#00AA00" },
  { code: "3", label: "Dark Aqua", hex: "#00AAAA" },
  { code: "4", label: "Dark Red", hex: "#AA0000" },
  { code: "5", label: "Dark Purple", hex: "#AA00AA" },
  { code: "6", label: "Gold", hex: "#FFAA00" },
  { code: "7", label: "Gray", hex: "#AAAAAA" },
  { code: "8", label: "Dark Gray", hex: "#555555" },
  { code: "9", label: "Blue", hex: "#5555FF" },
  { code: "a", label: "Green", hex: "#55FF55" },
  { code: "b", label: "Aqua", hex: "#55FFFF" },
  { code: "c", label: "Red", hex: "#FF5555" },
  { code: "d", label: "Light Purple", hex: "#FF55FF" },
  { code: "e", label: "Yellow", hex: "#FFFF55" },
  { code: "f", label: "White", hex: "#FFFFFF" },
] as const;

export const MOTD_FORMAT_CODES = [
  { code: "l", label: "Bold" },
  { code: "o", label: "Italic" },
  { code: "n", label: "Underline" },
  { code: "m", label: "Strikethrough" },
  { code: "k", label: "Obfuscated" },
  { code: "r", label: "Reset" },
] as const;

const COLOR_HEX = new Map<string, string>(MOTD_COLOR_CODES.map((c) => [c.code, c.hex]));

export interface MotdSegment {
  text: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  obfuscated?: boolean;
}

/** Splits a MOTD string on `§`-codes into styled segments, in source order. */
export function parseMotd(motd: string): MotdSegment[] {
  const segments: MotdSegment[] = [];
  let current: MotdSegment = { text: "" };

  for (let i = 0; i < motd.length; i++) {
    const ch = motd[i];
    if (ch === "§" && i + 1 < motd.length) {
      const code = motd[i + 1].toLowerCase();
      if (current.text) segments.push(current);
      if (code === "r") {
        current = { text: "" };
      } else if (COLOR_HEX.has(code)) {
        // A color code resets bold/italic/etc., matching real client behavior.
        current = { text: "", color: COLOR_HEX.get(code) };
      } else if (code === "l") {
        current = { ...current, text: "", bold: true };
      } else if (code === "o") {
        current = { ...current, text: "", italic: true };
      } else if (code === "n") {
        current = { ...current, text: "", underline: true };
      } else if (code === "m") {
        current = { ...current, text: "", strikethrough: true };
      } else if (code === "k") {
        current = { ...current, text: "", obfuscated: true };
      } else {
        // Not a recognized code — keep the literal "§X" as visible text.
        current = { ...current, text: current.text + ch + motd[i + 1] };
        i++;
        continue;
      }
      i++;
      continue;
    }
    current.text += ch;
  }
  if (current.text) segments.push(current);
  return segments;
}

/** Inserts a formatting code at a cursor position, returning the new string and cursor offset. */
export function insertMotdCode(value: string, cursor: number, code: string): { value: string; cursor: number } {
  const insertion = `§${code}`;
  const next = value.slice(0, cursor) + insertion + value.slice(cursor);
  return { value: next, cursor: cursor + insertion.length };
}
