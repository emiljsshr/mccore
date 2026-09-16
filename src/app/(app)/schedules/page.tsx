import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { SchedulesView } from "@/features/schedules/schedules-view";

export const metadata: Metadata = { title: "Schedules — Cometa mcCore" };

export default function SchedulesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Schedules" description="Automated actions running across every server." />
      <SchedulesView />
    </div>
  );
}
