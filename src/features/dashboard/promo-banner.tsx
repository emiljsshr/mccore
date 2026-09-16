import Link from "next/link";
import { ArrowRight } from "@/lib/icons";
import { LogoMark } from "@/components/shared/logo-mark";

export function PromoBanner() {
  return (
    <div className="relative isolate flex min-h-[280px] flex-col justify-between overflow-hidden rounded-xl p-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/Bg-image.png"
        alt=""
        className="absolute inset-0 -z-20 size-full object-cover"
      />
      <div
        className="absolute inset-0 -z-10"
        style={{ background: "linear-gradient(180deg, oklch(0.1 0.02 250 / 35%) 0%, oklch(0.08 0.02 250 / 80%) 100%)" }}
      />

      <div>
        <LogoMark className="size-7" />
      </div>

      <div className="space-y-3">
        <h2 className="text-2xl font-bold leading-tight text-white [text-shadow:0_1px_12px_rgb(0_0_0_/_0.4)]">
          Minecraft Infrastructure.
          <br />
          In Your Control.
        </h2>
        <p className="max-w-sm text-sm text-white/80 [text-shadow:0_1px_8px_rgb(0_0_0_/_0.5)]">
          Manage. Monitor. Automate. A modern platform for Minecraft servers — built for
          creators, communities and professionals.
        </p>
        <Button />
      </div>
    </div>
  );
}

function Button() {
  return (
    <Link
      href="/servers/new"
      className="inline-flex items-center gap-1.5 rounded-md bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition-opacity hover:opacity-90"
    >
      Create Server
      <ArrowRight className="size-4" />
    </Link>
  );
}
