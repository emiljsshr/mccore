"use client";

import { useRef } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MOTD_COLOR_CODES, MOTD_FORMAT_CODES, insertMotdCode, parseMotd } from "@/lib/minecraft-formatting";
import { Bold, ClearFormatting, Italic, Sparkles, Strikethrough, Underline } from "@/lib/icons";

const FORMAT_ICONS: Record<string, typeof Bold> = {
  l: Bold,
  o: Italic,
  n: Underline,
  m: Strikethrough,
  k: Sparkles,
  r: ClearFormatting,
};

const MAX_LENGTH = 200;

interface MotdEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function MotdEditor({ value, onChange }: MotdEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertCode(code: string) {
    const el = textareaRef.current;
    const cursor = el?.selectionStart ?? value.length;
    const { value: next, cursor: nextCursor } = insertMotdCode(value, cursor, code);
    if (next.length > MAX_LENGTH) return;
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  const lines = value.split("\n");

  return (
    <div className="space-y-2">
      <Label htmlFor="motd-editor">Message of the Day</Label>

      <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-surface p-1.5">
        {MOTD_COLOR_CODES.map((c) => (
          <button
            key={c.code}
            type="button"
            title={c.label}
            onClick={() => insertCode(c.code)}
            className="size-5 shrink-0 rounded-sm ring-1 ring-inset ring-white/10 transition-transform hover:scale-110"
            style={{ backgroundColor: c.hex }}
          />
        ))}
        <div className="mx-1 h-5 w-px shrink-0 bg-border" />
        {MOTD_FORMAT_CODES.map((f) => {
          const Icon = FORMAT_ICONS[f.code];
          return (
            <Button
              key={f.code}
              type="button"
              variant="ghost"
              size="icon"
              title={f.label}
              className="size-7"
              onClick={() => insertCode(f.code)}
            >
              <Icon className="size-3.5" />
            </Button>
          );
        })}
      </div>

      <Textarea
        id="motd-editor"
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          if (next.split("\n").length > 2 || next.length > MAX_LENGTH) return;
          onChange(next);
        }}
        placeholder="§aWelcome to my server!"
        rows={2}
        className="font-mono text-xs"
      />
      <p className="text-right text-xs text-muted-foreground">
        {lines.length}/2 lines · {value.length}/{MAX_LENGTH}
      </p>

      <div className="space-y-0.5 rounded-md border border-border bg-[#2a2a2a] px-3 py-2.5">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Server list preview
        </p>
        {lines.map((line, i) => (
          <p key={i} className="min-h-[1.25rem] font-mono text-sm leading-tight">
            {line === "" ? (
              <span>&nbsp;</span>
            ) : (
              parseMotd(line).map((seg, j) => (
                <span
                  key={j}
                  className={cn(
                    seg.bold && "font-bold",
                    seg.italic && "italic",
                    seg.underline && "underline",
                    seg.strikethrough && "line-through",
                    seg.obfuscated && "blur-[1.5px]",
                  )}
                  style={{ color: seg.color ?? "#FFFFFF" }}
                >
                  {seg.text}
                </span>
              ))
            )}
          </p>
        ))}
      </div>
    </div>
  );
}
