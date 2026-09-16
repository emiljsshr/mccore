"use client";

import { useUiStore } from "@/stores/use-ui-store";
import { SidebarContent } from "@/components/layout/sidebar-content";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-in-out lg:flex",
        collapsed ? "w-[68px]" : "w-64",
      )}
    >
      <SidebarContent collapsed={collapsed} onToggleCollapsed={toggleSidebar} />
    </aside>
  );
}
