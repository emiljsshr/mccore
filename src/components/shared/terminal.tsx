import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TerminalProps {
  toolbar: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  fullscreen?: boolean;
}

export function Terminal({ toolbar, children, footer, className, fullscreen }: TerminalProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-[oklch(0.14_0.006_240)]",
        fullscreen && "fixed inset-0 z-50 h-auto rounded-none",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-2">
        {toolbar}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-[13px] leading-relaxed">
        {children}
      </div>
      {footer && <div className="border-t border-white/10 bg-white/[0.02] p-2">{footer}</div>}
    </div>
  );
}
