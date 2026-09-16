"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "@/lib/nav-config";
import { ChevronsLeft, CircleCheck } from "@/lib/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDataStore } from "@/stores/use-data-store";
import { useServerStore } from "@/stores/use-server-store";
import { LogoMark } from "@/components/shared/logo-mark";
import { UserMenu } from "@/components/layout/user-menu";

interface SidebarContentProps {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}

export function SidebarContent({ collapsed = false, onToggleCollapsed, onNavigate }: SidebarContentProps) {
  const mockNodes = useDataStore(s => s.nodes);
  const mockServers = useServerStore(s => s.servers);
  const pathname = usePathname();

  return (
    <div className="flex h-full w-full min-w-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className={cn("relative flex h-16 shrink-0 items-center px-4", collapsed && "justify-center px-0")}>
        {collapsed ? (
          <LogoMark className="size-8" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/logo-full.png" alt="Cometa mcCore" className="h-9 w-auto object-contain object-left" />
        )}

        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "absolute top-1/2 hidden size-6 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-sidebar text-white/50 shadow-sm transition-colors hover:text-white lg:flex",
              collapsed ? "-right-3" : "right-3",
            )}
          >
            <ChevronsLeft className={cn("size-3.5 transition-transform", collapsed && "rotate-180")} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.label || `group-${groupIndex}`}>
            {!collapsed && group.label && (
              <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-white/35">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                const link = (
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-md py-1 pl-1 pr-3 text-[13px] font-medium text-white/60 transition-colors hover:text-white",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md text-white/45 transition-colors",
                        "group-hover:bg-white/10 group-hover:text-white/80",
                        active && "bg-sidebar-primary text-sidebar-primary-foreground group-hover:bg-sidebar-primary group-hover:text-sidebar-primary-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                    </span>
                    {!collapsed && (
                      <span className={cn("truncate", active && "font-semibold text-white")}>{item.label}</span>
                    )}
                  </Link>
                );

                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-white/8 px-3 py-3">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex justify-center py-1">
                <CircleCheck className="size-4 text-sidebar-primary" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">All systems operational</TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-2 text-xs">
            <CircleCheck className="size-3.5 shrink-0 text-sidebar-primary" />
            <div className="min-w-0">
              <p className="truncate font-medium text-white">All Systems Operational</p>
              <p className="truncate text-white/40">
                {mockNodes.length} Nodes · {mockServers.length} Servers
              </p>
            </div>
          </div>
        )}

        <UserMenu collapsed={collapsed} />
      </div>
    </div>
  );
}
