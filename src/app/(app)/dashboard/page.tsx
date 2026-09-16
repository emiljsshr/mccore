import type { Metadata } from "next";
import Link from "next/link";
import { DashboardGreeting } from "@/features/dashboard/greeting";
import { DashboardKpiRow } from "@/features/dashboard/kpi-row";
import { ServerOverviewList } from "@/features/dashboard/server-overview-list";
import { DashboardPerformanceSection } from "@/features/dashboard/performance-section";
import { RecentActivity } from "@/features/dashboard/recent-activity";
import { PromoBanner } from "@/features/dashboard/promo-banner";
import { NodesSummaryCard } from "@/features/dashboard/nodes-summary-card";
import { PluginUpdatesCard } from "@/features/dashboard/plugin-updates-card";

export const metadata: Metadata = { title: "Dashboard — Cometa mcCore" };

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <DashboardGreeting />
      <DashboardKpiRow />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="rounded-xl border border-border bg-card p-4 xl:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Server Overview</h2>
            <Link href="/servers" className="text-xs font-medium text-primary hover:underline">
              View All
            </Link>
          </div>
          <ServerOverviewList />
        </div>

        <div className="xl:col-span-4">
          <DashboardPerformanceSection />
        </div>

        <div className="xl:col-span-3">
          <RecentActivity />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <PromoBanner />
        </div>
        <div className="xl:col-span-4">
          <NodesSummaryCard />
        </div>
        <div className="xl:col-span-3">
          <PluginUpdatesCard />
        </div>
      </div>
    </div>
  );
}
