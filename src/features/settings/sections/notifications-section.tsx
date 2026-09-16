"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function NotificationsSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Notifications</CardTitle>
        <CardDescription>Instance notifications appear in the notification menu.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Per-event notification preferences and email delivery are not configured in this release.</p>
      </CardContent>
    </Card>
  );
}
