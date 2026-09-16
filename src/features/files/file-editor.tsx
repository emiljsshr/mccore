"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Save, Loader2 } from "@/lib/icons";
import { readFile, saveFile } from "@/services";
import type { FileEntry } from "@/types";

interface FileEditorProps {
  file: FileEntry | null;
  onOpenChange: (open: boolean) => void;
}

export function FileEditor({ file, onOpenChange }: FileEditorProps) {
  const [content, setContent] = useState<string | null>(null);
  const [originalContent, setOriginalContent] = useState<string>("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!file) return;
    let active = true;
    readFile(file.serverId, file.path + file.name).then((text) => {
      if (!active) return;
      setContent(text);
      setOriginalContent(text);
    });
    return () => {
      active = false;
    };
  }, [file]);

  const lines = useMemo(() => (content ?? "").split("\n"), [content]);
  const isDirty = content !== null && content !== originalContent;

  const matchingLines = useMemo(() => {
    if (!search) return null;
    return new Set(
      lines
        .map((line, i) => (line.toLowerCase().includes(search.toLowerCase()) ? i : -1))
        .filter((i) => i >= 0),
    );
  }, [lines, search]);

  async function handleSave() {
    if (!file || content === null) return;
    setSaving(true);
    try {
      await saveFile(file.serverId, file.path + file.name, content);
      setOriginalContent(content);
      toast.success(`${file.name} saved`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={Boolean(file)} onOpenChange={(open) => !open && onOpenChange(false)}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-2xl">
        <SheetHeader className="flex-row items-center justify-between space-y-0 border-b border-border pb-3">
          <div className="min-w-0">
            <SheetTitle className="flex items-center gap-2 truncate">
              {file?.name}
              {isDirty && <span className="size-1.5 shrink-0 rounded-full bg-status-warning" />}
            </SheetTitle>
            <SheetDescription className="truncate font-mono text-xs">
              {file ? file.path + file.name : ""}
            </SheetDescription>
          </div>
          <Button size="sm" onClick={handleSave} disabled={!isDirty || saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save
          </Button>
        </SheetHeader>

        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <Search className="size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search in file..."
            className="h-7 border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="flex-1 overflow-auto">
          {content === null ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : (
            <div className="flex font-mono text-[13px] leading-6">
              <div className="select-none border-r border-border bg-surface px-3 py-3 text-right text-muted-foreground/60">
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
                className="min-h-full flex-1 resize-none bg-transparent px-3 py-3 text-foreground outline-none"
                style={{ whiteSpace: "pre" }}
              />
            </div>
          )}
        </div>

        {matchingLines && (
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            {matchingLines.size} line{matchingLines.size === 1 ? "" : "s"} match &quot;{search}&quot;
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
