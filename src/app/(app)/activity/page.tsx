import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ActivityLog } from "@/features/activity/activity-log";

export const metadata: Metadata = { title: "Activity — Cometa mcCore" };

export default function ActivityPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Activity" description="A complete audit log of actions taken across your infrastructure." />
      <ActivityLog />
    </div>
  );
}
