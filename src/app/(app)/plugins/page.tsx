import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { MarketplaceView } from "@/features/marketplace/marketplace-view";

export const metadata: Metadata = { title: "Plugins & Mods — Cometa mcCore" };

export default function PluginsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Plugins & Mods"
        description="Browse Modrinth and install directly onto any server in your infrastructure."
      />
      <MarketplaceView />
    </div>
  );
}
