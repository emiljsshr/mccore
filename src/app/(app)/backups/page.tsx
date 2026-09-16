import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { BackupsView } from "@/features/backups/backups-view";

export const metadata: Metadata = { title: "Backups — Cometa mcCore" };

export default function BackupsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Backups" description="All backups across every server in your infrastructure." />
      <BackupsView />
    </div>
  );
}
