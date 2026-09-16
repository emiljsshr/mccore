/**
 * The full, searchable Tabler icon set (6000+ icons). This module namespace-
 * imports the entire `@tabler/icons-react` package, which is unavoidably
 * heavy — keep it out of any eagerly-loaded module. It's only ever reached
 * via a dynamic `import()` from the icon picker, so its weight lands in its
 * own chunk, loaded on demand when a user opens the picker.
 */
import * as TablerIcons from "@tabler/icons-react";
import type { TablerIcon } from "@tabler/icons-react";
import { DEFAULT_SERVER_ICON, humanizeIconName } from "./server-icon-registry";

const ALL_ICON_ENTRIES: [string, TablerIcon][] = Object.entries(TablerIcons)
  .filter(([name, value]) => name.startsWith("Icon") && typeof value === "object")
  .map(([name, value]) => [name.slice(4), value as TablerIcon]);

const FULL_ICON_MAP = new Map(ALL_ICON_ENTRIES);

export function getServerIconFromFullSet(name: string): TablerIcon {
  return FULL_ICON_MAP.get(name) ?? FULL_ICON_MAP.get(DEFAULT_SERVER_ICON)!;
}

export function searchAllServerIcons(query: string, limit = 60): { key: string; label: string; Icon: TablerIcon }[] {
  const trimmed = query.trim().toLowerCase();
  const source = trimmed ? ALL_ICON_ENTRIES.filter(([name]) => name.toLowerCase().includes(trimmed)) : [];
  return source.slice(0, limit).map(([key, Icon]) => ({ key, label: humanizeIconName(key), Icon }));
}
