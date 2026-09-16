import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { CreateServerWizard } from "@/features/servers/create/create-server-wizard";

export const metadata: Metadata = { title: "Create Server — Cometa mcCore" };

export default function CreateServerPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Create Server" description="Set up a new Minecraft server in a few steps." />
      <CreateServerWizard />
    </div>
  );
}
