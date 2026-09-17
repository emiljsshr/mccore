"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { PlatformUser } from "@/types";
import { PlayerAvatar } from "@/components/shared/player-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mail } from "@/lib/icons";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useServerStore } from "@/stores/use-server-store";
import { ROLE_LABEL, STATUS_CONFIG } from "@/features/users/columns";
import { UserActions } from "@/features/users/user-actions";
import { useRouter } from "next/navigation";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export function UserDetailView({ user }: { user: PlatformUser }) {
  const router = useRouter();
  const allServers = useServerStore((s) => s.servers);
  const accessibleServers = useMemo(
    () => allServers.filter((s) => user.serverIds.includes(s.id)),
    [allServers, user.serverIds],
  );
  const statusConfig = STATUS_CONFIG[user.status];

  return (
    <div className="space-y-6">
      <Link
        href="/users"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to Users
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <PlayerAvatar seed={user.avatarSeed} size="xl" square={false} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{user.name}</h1>
              <Badge className={cn(statusConfig.className)}>{statusConfig.label}</Badge>
            </div>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="size-3.5" />
              {user.email}
            </p>
          </div>
        </div>
        <UserActions user={user} onDeleted={() => router.push("/users")} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Account</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <InfoRow label="Role" value={ROLE_LABEL[user.role]} />
            <InfoRow label="Status" value={statusConfig.label} />
            <InfoRow label="Last Active" value={formatRelativeTime(user.lastActive)} />
            <InfoRow label="Member Since" value={formatDate(user.createdAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Server Access</CardTitle>
          </CardHeader>
          <CardContent>
            {user.role === "owner" || user.role === "administrator" ? (
              <p className="text-sm text-muted-foreground">Access to every server (granted by role).</p>
            ) : accessibleServers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No servers assigned.</p>
            ) : (
              <ul className="space-y-1">
                {accessibleServers.map((server) => (
                  <li key={server.id}>
                    <Link
                      href={`/servers/${server.id}`}
                      className="block truncate rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-hover"
                    >
                      {server.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
