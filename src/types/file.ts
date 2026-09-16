export type FileEntryKind =
  | "folder"
  | "yaml"
  | "json"
  | "jar"
  | "txt"
  | "log"
  | "zip"
  | "world"
  | "properties"
  | "unknown";

export interface FileEntry {
  id: string;
  serverId: string;
  path: string;
  name: string;
  kind: FileEntryKind;
  sizeBytes: number;
  modifiedAt: string;
  permissions: string;
  editable: boolean;
}
