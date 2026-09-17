"use client";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/shared/data-table";
import { userColumns } from "@/features/users/columns";
import { InviteUserDialog } from "@/features/users/invite-user-dialog";
import { RolesView } from "@/features/users/roles-view";
import { useDataStore } from "@/stores/use-data-store";
import type { PlatformUser } from "@/types";


export default function UsersPage() {
  const router = useRouter();
  const users = useDataStore(s => s.users);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage who has access to your infrastructure and what they can do."
        actions={<InviteUserDialog />}
      />

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4">
          <DataTable
            columns={userColumns}
            data={users}
            onRowClick={(user: PlatformUser) => router.push(`/users/${user.id}`)}
          />
        </TabsContent>
        <TabsContent value="roles" className="mt-4">
          <RolesView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
