"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Server,
  Users,
  Box,
  Archive,
  Network,
  TriangleAlert,
  Mail,
  Terminal,
  Keyboard,
} from "@/lib/icons";
import type { LucideIcon } from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

interface HelpTopic {
  category: string;
  icon: LucideIcon;
  question: string;
  answer: string;
}

const TOPICS: HelpTopic[] = [
  {
    category: "Servers",
    icon: Server,
    question: "How do I create a new Minecraft server?",
    answer:
      "Click \"Create Server\" in the header or on the Servers page, then walk through the wizard: basics, software, version, resources, network and game settings. Your server installs automatically once you confirm.",
  },
  {
    category: "Servers",
    icon: Server,
    question: "What's the difference between Stop and Kill?",
    answer:
      "Stop gracefully shuts the server down, saving the world and notifying players first. Kill immediately terminates the process — use it only when a server is unresponsive, since it can cause data loss.",
  },
  {
    category: "Players",
    icon: Users,
    question: "How do I ban or whitelist a player?",
    answer:
      "Open a server's Players tab, select a player to open their detail drawer, then use the Ban or Whitelist actions. You can review banned and whitelisted players from the tabs at the top of the Players page.",
  },
  {
    category: "Plugins",
    icon: Box,
    question: "Where do I install plugins?",
    answer:
      "Go to a server's Plugins tab and open Discover to search the marketplace. Installing a plugin downloads and enables it automatically; some plugins require a server restart to finish loading.",
  },
  {
    category: "Backups",
    icon: Archive,
    question: "How often are backups created automatically?",
    answer:
      "Automatic backup frequency is configured per server under Backups → Create Backup, or set as a platform-wide default in Settings → Backups. You can also trigger a manual backup at any time.",
  },
  {
    category: "Backups",
    icon: Archive,
    question: "Restoring a backup overwrote my data — can I undo it?",
    answer:
      "Restoring replaces the server's current worlds and configuration with the backup's contents, and cannot be undone. We recommend taking a fresh manual backup immediately before restoring an older one.",
  },
  {
    category: "Networks",
    icon: Network,
    question: "How do Velocity networks work here?",
    answer:
      "A network groups a Velocity proxy server with the backend servers it routes players to. Manage this under Networks — the diagram shows live status and player counts for every connected server.",
  },
  {
    category: "Troubleshooting",
    icon: TriangleAlert,
    question: "A server shows \"Degraded\" or high resource usage — what now?",
    answer:
      "Check the server's Overview tab for CPU, memory and TPS trends. Sustained high CPU or low TPS usually means too many players or plugins for the allocated resources — consider increasing memory in Settings or moving the server to a healthier node.",
  },
];

const QUICK_LINKS = [
  { label: "Servers", description: "Create, start, stop and configure servers.", href: "/servers", icon: Server },
  { label: "Players", description: "Manage bans, whitelist and operators.", href: "/servers", icon: Users },
  { label: "Backups", description: "Automatic and manual backup policies.", href: "/backups", icon: Archive },
  { label: "Networks", description: "Velocity proxies and connected servers.", href: "/networks", icon: Network },
];

export function HelpView() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOPICS;
    return TOPICS.filter(
      (t) => t.question.toLowerCase().includes(q) || t.answer.toLowerCase().includes(q) || t.category.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="space-y-8">
      <div className="relative mx-auto max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help articles..."
          className="h-11 pl-10"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.label} href={link.href}>
              <Card className="gap-2 p-4 transition-colors hover:bg-hover">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <p className="text-sm font-medium text-foreground">{link.label}</p>
                <p className="text-xs text-muted-foreground">{link.description}</p>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Frequently Asked Questions</h2>
          {filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
              No help articles match &quot;{query}&quot;.
            </p>
          ) : (
            <Accordion type="single" collapsible className="rounded-xl border border-border bg-card px-2">
              {filtered.map((topic, i) => {
                const Icon = topic.icon;
                return (
                  <AccordionItem key={topic.question} value={String(i)}>
                    <AccordionTrigger className="gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Icon className="size-3.5" />
                      </span>
                      <span className="flex-1 text-left">{topic.question}</span>
                      <Badge variant="secondary" className="mr-2 hidden text-[10px] sm:inline-flex">
                        {topic.category}
                      </Badge>
                    </AccordionTrigger>
                    <AccordionContent className="pl-10">{topic.answer}</AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>

        <div className="space-y-4">
          <Card className="gap-3 p-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="size-4" />
            </span>
            <p className="text-sm font-medium text-foreground">Contact Support</p>
            <p className="text-xs text-muted-foreground">
              Can&apos;t find what you&apos;re looking for? Reach out and we&apos;ll help you out.
            </p>
            <a
              href="mailto:support@cometa.net"
              className="text-sm font-medium text-primary hover:underline"
            >
              support@cometa.net
            </a>
          </Card>

          <CardContent className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Keyboard className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Keyboard Shortcuts</p>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Open command palette</span>
                <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono">⌘K</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Navigate console history</span>
                <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono">↑ / ↓</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Close dialogs</span>
                <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono">Esc</kbd>
              </div>
            </div>
          </CardContent>

          <CardContent className="space-y-2 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Terminal className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Status</p>
            </div>
            <p className="text-xs text-muted-foreground">
              All systems are currently operational. Check the Activity log for recent platform events.
            </p>
            <Link href="/activity" className="text-xs font-medium text-primary hover:underline">
              View activity log →
            </Link>
          </CardContent>
        </div>
      </div>
    </div>
  );
}
