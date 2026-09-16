import type { ReactNode } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/shared/logo-mark";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <div className="relative hidden w-[45%] shrink-0 overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Bg-image.png" alt="" className="absolute inset-0 -z-20 size-full object-cover" />
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "linear-gradient(180deg, oklch(0.08 0.02 250 / 55%) 0%, oklch(0.08 0.02 250 / 85%) 100%)" }}
        />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-full.png" alt="Cometa mcCore" className="h-9 w-auto object-contain object-left" />

        <div className="space-y-3">
          <h2 className="max-w-sm text-3xl font-bold leading-tight text-white [text-shadow:0_1px_12px_rgb(0_0_0_/_0.4)]">
            Minecraft Infrastructure. In Your Control.
          </h2>
          <p className="max-w-sm text-sm text-white/75 [text-shadow:0_1px_8px_rgb(0_0_0_/_0.5)]">
            One professional dashboard for every server, node and player across your network.
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <Link href="/dashboard" className="flex items-center gap-2.5 lg:hidden">
            <LogoMark className="size-8" />
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-wide text-foreground">COMETA</p>
              <p className="text-[11px] font-semibold tracking-[0.2em] text-primary">mcCORE</p>
            </div>
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
