"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SERVER_DETAIL_NAV } from "@/lib/nav-config";
import { cn } from "@/lib/utils";

export function ServerDetailTabs({ serverId }: { serverId: string }) {
  const pathname = usePathname();
  const base = `/servers/${serverId}`;

  return (
    <div className="scrollbar-thin -mx-1 overflow-x-auto border-b border-border">
      <nav className="flex min-w-max gap-1 px-1">
        {SERVER_DETAIL_NAV.map((item) => {
          const href = item.segment ? `${base}/${item.segment}` : base;
          const active = pathname === href;
          return (
            <Link
              key={item.segment || "overview"}
              href={href}
              className={cn(
                "relative whitespace-nowrap px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                active && "text-foreground",
              )}
            >
              {item.label}
              {active && (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
