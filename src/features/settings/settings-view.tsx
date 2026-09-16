"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  User,
  Palette,
  Shield,
  Bell,
  Box,
  Database,
  Archive,
  KeyRound,
  Webhook,
} from "@/lib/icons";
import type { LucideIcon } from "@/lib/icons";
import { GeneralSection } from "@/features/settings/sections/general-section";
import { AppearanceSection } from "@/features/settings/sections/appearance-section";
import { SecuritySection } from "@/features/settings/sections/security-section";
import { NotificationsSection } from "@/features/settings/sections/notifications-section";
import { MinecraftSection } from "@/features/settings/sections/minecraft-section";
import { StorageSection } from "@/features/settings/sections/storage-section";
import { BackupsSection } from "@/features/settings/sections/backups-section";
import { ApiSection } from "@/features/settings/sections/api-section";
import { IntegrationsSection } from "@/features/settings/sections/integrations-section";

interface SettingsSection {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  component: React.ComponentType;
}

interface SettingsGroup {
  label: string;
  sections: SettingsSection[];
}

const GROUPS: SettingsGroup[] = [
  {
    label: "Account",
    sections: [
      { id: "general", label: "General", description: "Your platform and account details.", icon: User, component: GeneralSection },
      { id: "appearance", label: "Appearance", description: "Customize how Cometa mcCore looks.", icon: Palette, component: AppearanceSection },
      { id: "security", label: "Security", description: "Two-factor auth and active sessions.", icon: Shield, component: SecuritySection },
      { id: "notifications", label: "Notifications", description: "Notification availability.", icon: Bell, component: NotificationsSection },
    ],
  },
  {
    label: "Platform",
    sections: [
      { id: "minecraft", label: "Minecraft", description: "Defaults applied to new servers.", icon: Box, component: MinecraftSection },
      { id: "storage", label: "Storage", description: "Disk usage across your nodes.", icon: Database, component: StorageSection },
      { id: "backups", label: "Backups", description: "Automatic backup schedules.", icon: Archive, component: BackupsSection },
    ],
  },
  {
    label: "Developer",
    sections: [
      { id: "api", label: "API", description: "Keys used to authenticate API requests.", icon: KeyRound, component: ApiSection },
      { id: "integrations", label: "Integrations", description: "Connect Cometa mcCore to other tools.", icon: Webhook, component: IntegrationsSection },
    ],
  },
];

const ALL_SECTIONS = GROUPS.flatMap((g) => g.sections);

export function SettingsView() {
  const [activeId, setActiveId] = useState<string>("general");
  const active = ALL_SECTIONS.find((s) => s.id === activeId) ?? ALL_SECTIONS[0];
  const ActiveComponent = active.component;
  const ActiveIcon = active.icon;

  return (
    <div className="flex flex-col gap-6 overflow-hidden rounded-xl border border-border bg-card lg:flex-row">
      <nav className="shrink-0 space-y-5 overflow-x-auto border-border p-3 lg:w-60 lg:overflow-visible lg:border-r lg:p-4">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </p>
            <div className="flex gap-1 lg:flex-col lg:gap-0.5">
              {group.sections.map((section) => {
                const Icon = section.icon;
                const isActive = section.id === activeId;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveId(section.id)}
                    className={cn(
                      "flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-hover hover:text-foreground",
                      isActive && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-md",
                        isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    {section.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="min-w-0 flex-1 space-y-6 p-4 pt-0 lg:p-6">
        <div className="flex items-center gap-3 border-b border-border pb-4 lg:pt-0">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ActiveIcon className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">{active.label}</h2>
            <p className="text-sm text-muted-foreground">{active.description}</p>
          </div>
        </div>
        <ActiveComponent />
      </div>
    </div>
  );
}
