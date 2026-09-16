"use client";

import Link from "next/link";
import { Fragment } from "react";
import { Search } from "@/lib/icons";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { NotificationCenter } from "@/components/layout/notification-center";
import { HeaderUserMenu } from "@/components/layout/header-user-menu";
import { useUiStore } from "@/stores/use-ui-store";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const crumbs = useBreadcrumbs();
  const showBreadcrumbs = crumbs.length > 1;

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
      <MobileSidebar />

      {showBreadcrumbs && (
        <div className="hidden shrink-0 lg:block">
          <Breadcrumb>
            <BreadcrumbList>
              {crumbs.map((crumb, i) => (
                <Fragment key={i}>
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {crumb.href ? (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      )}

      <button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        className={cn(
          "hidden flex-1 items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-hover hover:text-foreground md:flex md:max-w-md lg:max-w-lg",
        )}
      >
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">Search servers, players, plugins...</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
          ⌘K
        </kbd>
      </button>

      <div className="flex-1" />

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <Search className="size-4" />
          <span className="sr-only">Search</span>
        </Button>
        <NotificationCenter />
        <HeaderUserMenu />  
      </div>
    </header>
  );
}
