"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconBrandDiscord, IconBrandSlack, IconWebhook } from "@tabler/icons-react";
import type { TablerIcon } from "@tabler/icons-react";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: TablerIcon;
  connected: boolean;
}

const INITIAL: Integration[] = [
  { id: "discord", name: "Discord", description: "Post server events to a Discord channel.", icon: IconBrandDiscord, connected: false },
  { id: "slack", name: "Slack", description: "Send alerts and notifications to Slack.", icon: IconBrandSlack, connected: false },
  { id: "webhook", name: "Custom Webhook", description: "Forward events to any HTTP endpoint.", icon: IconWebhook, connected: false },
];

export function IntegrationsSection() {
  const integrations = INITIAL;


  return (
    <Card>
      <CardContent className="divide-y divide-border">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          return (
            <div key={integration.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{integration.name}</p>
                  <p className="text-xs text-muted-foreground">{integration.description}</p>
                </div>
              </div>
              <Button
                variant={integration.connected ? "outline" : "default"}
                size="sm"
                disabled
              >
                Not configured
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
