import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ServerList } from "@/features/servers/server-list";
import { CirclePlus } from "@/lib/icons";

export const metadata: Metadata = { title: "Servers — Cometa mcCore" };

export default function ServersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Servers"
        description="Manage every Minecraft server across your infrastructure."
        actions={
          <Button asChild>
            <Link href="/servers/new">
              <CirclePlus className="size-4" />
              Create Server
            </Link>
          </Button>
        }
      />
      <ServerList />
    </div>
  );
}
