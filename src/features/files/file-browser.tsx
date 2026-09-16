"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FileIcon } from "@/features/files/file-icon";
import { FileEditor } from "@/features/files/file-editor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2 } from "@/lib/icons";
import { formatDateTime, formatFileSize } from "@/lib/format";
import { listFiles, deleteFile } from "@/services";
import type { FileEntry } from "@/types";
import {
  FilePlus,
  FolderPlus,
  Upload,
  Download,
  Pencil,
  Copy,
  Move,
  FolderOpen,
} from "@/lib/icons";
import { Fragment } from "react";

export function FileBrowser({ serverId }: { serverId: string }) {
  const [path, setPath] = useState("/");
  const [entries, setEntries] = useState<FileEntry[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingFile, setEditingFile] = useState<FileEntry | null>(null);
  const [toDelete, setToDelete] = useState<FileEntry | null>(null);

  useEffect(() => {
    let active = true;
    listFiles(serverId, path).then((files) => {
      if (active) setEntries(files);
    });
    return () => {
      active = false;
    };
  }, [serverId, path]);

  const segments = path.split("/").filter(Boolean);

  function goTo(index: number) {
    if (index < 0) {
      setPath("/");
    } else {
      setPath("/" + segments.slice(0, index + 1).join("/") + "/");
    }
    setSelected(new Set());
  }

  function openEntry(entry: FileEntry) {
    if (entry.kind === "folder") {
      setPath(`${path}${entry.name}/`);
      setSelected(new Set());
    } else if (entry.editable) {
      setEditingFile(entry);
    } else {
      toast.info(`${entry.name} cannot be previewed in this demo.`);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete() {
    if (!toDelete) return;
    await deleteFile(toDelete.serverId, toDelete.path + toDelete.name);
    setEntries((prev) => prev?.filter((e) => e.id !== toDelete.id) ?? null);
    toast.success(`${toDelete.name} deleted`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {segments.length === 0 ? (
                <BreadcrumbPage>/</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <button onClick={() => goTo(-1)}>/</button>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {segments.map((segment, i) => (
              <Fragment key={i}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {i === segments.length - 1 ? (
                    <BreadcrumbPage>{segment}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <button onClick={() => goTo(i)}>{segment}</button>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => toast.info("Create file (demo)")}>
            <FilePlus className="size-3.5" /> New File
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("Create folder (demo)")}>
            <FolderPlus className="size-3.5" /> New Folder
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("Upload (demo)")}>
            <Upload className="size-3.5" /> Upload
          </Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm">
          <span className="text-muted-foreground">{selected.size} selected</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => toast.info("Download (demo)")}>
              <Download className="size-3.5" /> Download
            </Button>
            <Button variant="ghost" size="sm" onClick={() => toast.info("Move (demo)")}>
              <Move className="size-3.5" /> Move
            </Button>
            <Button variant="ghost" size="sm" onClick={() => toast.info("Copy (demo)")}>
              <Copy className="size-3.5" /> Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={() => toast.info("Rename (demo)")}>
              <Pencil className="size-3.5" /> Rename
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-[1fr_80px_120px_32px] gap-2 border-b border-border bg-surface px-3 py-2 text-xs font-medium text-muted-foreground sm:grid-cols-[1fr_100px_160px_120px_32px]">
          <span>Name</span>
          <span className="text-right">Size</span>
          <span>Modified</span>
          <span className="hidden sm:block">Permissions</span>
          <span />
        </div>

        {entries === null ? (
          <div className="space-y-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0">
                <Skeleton className="size-4" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState icon={FolderOpen} title="This folder is empty" className="border-none" />
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="grid cursor-pointer grid-cols-[1fr_80px_120px_32px] items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0 hover:bg-hover sm:grid-cols-[1fr_100px_160px_120px_32px]"
              onClick={() => openEntry(entry)}
            >
              <div className="flex min-w-0 items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(entry.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelect(entry.id)}
                  className="size-3.5 accent-primary"
                  aria-label={`Select ${entry.name}`}
                />
                <FileIcon kind={entry.kind} />
                <span className="truncate text-foreground">{entry.name}</span>
              </div>
              <span className="text-right text-xs tabular-nums text-muted-foreground">
                {entry.kind === "folder" ? "—" : formatFileSize(entry.sizeBytes)}
              </span>
              <span className="text-xs text-muted-foreground">{formatDateTime(entry.modifiedAt)}</span>
              <span className="hidden font-mono text-xs text-muted-foreground sm:block">{entry.permissions}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => toast.info("Rename (demo)")}>
                    <Pencil /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info("Move (demo)")}>
                    <Move /> Move
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info("Copy (demo)")}>
                    <Copy /> Copy
                  </DropdownMenuItem>
                  {entry.kind !== "folder" && (
                    <DropdownMenuItem onClick={() => toast.info("Download (demo)")}>
                      <Download /> Download
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setToDelete(entry)}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))
        )}
      </div>

      <FileEditor file={editingFile} onOpenChange={(open) => !open && setEditingFile(null)} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        description="This permanently removes the file or folder from the server."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
