"use client";

import { useState } from "react";
import { Menu } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarContent } from "@/components/layout/sidebar-content";
import { VisuallyHidden } from "radix-ui";

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-4" />
        <span className="sr-only">Open navigation</span>
      </Button>
      <SheetContent side="left" className="w-64 p-0">
        <VisuallyHidden.Root>
          <SheetTitle>Navigation</SheetTitle>
        </VisuallyHidden.Root>
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
