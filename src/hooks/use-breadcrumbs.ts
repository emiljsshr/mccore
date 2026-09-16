"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useServerStore } from "@/stores/use-server-store";
import { SERVER_DETAIL_NAV } from "@/lib/nav-config";
import { useDataStore } from "@/stores/use-data-store";

export interface Breadcrumb {
  label: string;
  href?: string;
}

const STATIC_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  servers: "Servers",
  networks: "Networks",
  nodes: "Nodes",
  users: "Users",
  schedules: "Schedules",
  backups: "Backups",
  activity: "Activity",
  settings: "Settings",
  help: "Help",
  new: "Create Server",
};

export function useBreadcrumbs(): Breadcrumb[] {
  const nodes = useDataStore(s => s.nodes);
  const pathname = usePathname();
  const servers = useServerStore((s) => s.servers);

  return useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) return [];

    const crumbs: Breadcrumb[] = [];

    if (segments[0] === "servers" && segments[1] && segments[1] !== "new") {
      const server = servers.find((s) => s.id === segments[1]);
      crumbs.push({ label: "Servers", href: "/servers" });
      crumbs.push({
        label: server?.name ?? segments[1],
        href: segments.length > 2 ? `/servers/${segments[1]}` : undefined,
      });
      if (segments[2]) {
        const navItem = SERVER_DETAIL_NAV.find((n) => n.segment === segments[2]);
        crumbs.push({ label: navItem?.label ?? segments[2] });
      }
      return crumbs;
    }

    if (segments[0] === "nodes" && segments[1]) {
      const node = nodes.find((n) => n.id === segments[1]);
      crumbs.push({ label: "Nodes", href: "/nodes" });
      crumbs.push({ label: node?.name ?? segments[1] });
      return crumbs;
    }

    segments.forEach((segment, index) => {
      const href = "/" + segments.slice(0, index + 1).join("/");
      crumbs.push({
        label: STATIC_LABELS[segment] ?? decodeURIComponent(segment),
        href: index < segments.length - 1 ? href : undefined,
      });
    });

    return crumbs;
  }, [pathname, servers, nodes]);
}
