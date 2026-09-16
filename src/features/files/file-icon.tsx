import {
  Folder,
  FileCode,
  FileJson,
  FileArchive,
  FileText,
  ScrollText,
  Box,
  Globe,
  File,
} from "@/lib/icons";
import type { FileEntryKind } from "@/types";
import { cn } from "@/lib/utils";

const ICON_CONFIG: Record<FileEntryKind, { icon: typeof File; className: string }> = {
  folder: { icon: Folder, className: "text-status-info fill-status-info/20" },
  yaml: { icon: FileCode, className: "text-violet-500" },
  json: { icon: FileJson, className: "text-amber-500" },
  jar: { icon: Box, className: "text-orange-500" },
  txt: { icon: FileText, className: "text-muted-foreground" },
  log: { icon: ScrollText, className: "text-muted-foreground" },
  zip: { icon: FileArchive, className: "text-muted-foreground" },
  world: { icon: Globe, className: "text-status-online" },
  properties: { icon: FileCode, className: "text-sky-500" },
  unknown: { icon: File, className: "text-muted-foreground" },
};

export function FileIcon({ kind, className }: { kind: FileEntryKind; className?: string }) {
  const config = ICON_CONFIG[kind];
  const Icon = config.icon;
  return <Icon className={cn("size-4 shrink-0", config.className, className)} />;
}
