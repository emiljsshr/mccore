"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useDataStore } from "@/stores/use-data-store";
import { UserDetailView } from "@/features/users/user-detail-view";

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const users = useDataStore((s) => s.users);
  const { id } = use(params);
  const user = users.find((u) => u.id === id);

  if (!user) notFound();

  return <UserDetailView user={user} />;
}
