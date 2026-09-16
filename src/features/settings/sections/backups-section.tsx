"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function BackupsSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Automatic Backups</CardTitle>
        <CardDescription>Configure a backup schedule for each server.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Global backup defaults and automatic retention are not implemented yet. Existing backups are kept until you delete them.</p>
        <Button asChild><Link href="/schedules">Manage Schedules</Link></Button>
      </CardContent>
    </Card>
  );
}
