import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsView } from "@/features/settings/settings-view";

export const metadata: Metadata = { title: "Settings — Cometa mcCore" };

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Configure your Cometa mcCore platform." />
      <SettingsView />
    </div>
  );
}
