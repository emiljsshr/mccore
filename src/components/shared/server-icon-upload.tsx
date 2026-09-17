"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Upload } from "@/lib/icons";

const ICON_SIZE = 64;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

interface ServerIconUploadProps {
  /** Base64-encoded PNG (no `data:` prefix), or empty when nothing is staged. */
  value: string;
  onChange: (base64: string) => void;
}

export function ServerIconUpload({ value, onChange }: ServerIconUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value ? `data:image/png;base64,${value}` : null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      toast.error("Image is too large (max 8 MB).");
      return;
    }
    try {
      const base64 = await resizeToServerIcon(file);
      onChange(base64);
      setPreviewUrl(`data:image/png;base64,${base64}`);
    } catch {
      toast.error("Could not read that image.");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface">
        {previewUrl ? (
          // A locally-generated 64x64 data: URI, not a remote image — next/image's
          // optimization pipeline doesn't apply here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Server icon preview" className="size-full [image-rendering:pixelated]" />
        ) : (
          <span className="text-[9px] text-muted-foreground">64×64</span>
        )}
      </div>
      <div className="space-y-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="size-3.5" /> Upload Icon
        </Button>
        <p className="text-xs text-muted-foreground">Shown in the Minecraft multiplayer server list. Resized to 64×64.</p>
      </div>
    </div>
  );
}

/** Center-crops to a square, then scales to the 64x64 Minecraft server-icon.png expects. */
function resizeToServerIcon(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = ICON_SIZE;
      canvas.height = ICON_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, ICON_SIZE, ICON_SIZE);
      resolve(canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, ""));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}
