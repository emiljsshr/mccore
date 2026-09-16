"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { hashStringToSeed } from "@/lib/seeded-random";

const FALLBACK_PALETTE = [
  "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  "bg-violet-500/20 text-violet-600 dark:text-violet-400",
  "bg-rose-500/20 text-rose-600 dark:text-rose-400",
  "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400",
];

const SIZE_CLASSES = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-12 text-base",
  xl: "size-20 text-2xl",
};

interface PlayerAvatarProps {
  seed: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
  square?: boolean;
}

/**
 * Renders a Minecraft-style player head. Uses a public head-rendering service
 * (minotar.net) keyed by username, and falls back to a deterministic initials
 * tile if the image fails to load (offline demo environments, blocked hosts).
 */
export function PlayerAvatar({ seed, size = "md", className, square = true }: PlayerAvatarProps) {
  const [errored, setErrored] = useState(false);
  const initials = seed.slice(0, 2).toUpperCase();
  const paletteIndex = Math.abs(hashStringToSeed(seed)) % FALLBACK_PALETTE.length;

  if (errored) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center font-semibold",
          square ? "rounded-md" : "rounded-full",
          SIZE_CLASSES[size],
          FALLBACK_PALETTE[paletteIndex],
          className,
        )}
      >
        {initials}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://minotar.net/avatar/${encodeURIComponent(seed)}/64.png`}
      alt={seed}
      width={64}
      height={64}
      onError={() => setErrored(true)}
      className={cn(
        "inline-block shrink-0 bg-muted",
        square ? "rounded-md" : "rounded-full",
        SIZE_CLASSES[size],
        className,
      )}
    />
  );
}
