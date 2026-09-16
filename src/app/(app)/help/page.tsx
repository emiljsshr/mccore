import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { HelpView } from "@/features/help/help-view";

export const metadata: Metadata = { title: "Help — Cometa mcCore" };

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Help & Support" description="Find answers, browse guides, or get in touch with us." />
      <HelpView />
    </div>
  );
}
