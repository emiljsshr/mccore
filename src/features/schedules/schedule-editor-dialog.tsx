"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus } from "@/lib/icons";
import { createSchedule } from "@/services";
import type { ScheduleAction } from "@/types";
import { SCHEDULE_ACTION_LABEL } from "@/types";

const ACTIONS: ScheduleAction[] = ["restart", "stop", "start", "backup", "command", "message"];
const PRESETS = [
  { label: "Every day at 04:00", cron: "0 4 * * *", description: "Every day at 04:00" },
  { label: "Every 6 hours", cron: "0 */6 * * *", description: "Every 6 hours" },
  { label: "Every hour", cron: "0 * * * *", description: "Every hour" },
  { label: "Every Sunday at 00:00", cron: "0 0 * * 0", description: "Every Sunday at 00:00" },
  { label: "Custom (advanced)", cron: "", description: "" },
];

export function ScheduleEditorDialog({ serverId, onCreated }: { serverId: string; onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [action, setAction] = useState<ScheduleAction>("restart");
  const [payload, setPayload] = useState("");
  const [presetIndex, setPresetIndex] = useState(0);
  const [customCron, setCustomCron] = useState("0 4 * * *");
  const [timezone, setTimezone] = useState("Europe/Berlin");
  const [enabled, setEnabled] = useState(true);

  const isAdvanced = presetIndex === PRESETS.length - 1;
  const needsPayload = action === "command" || action === "message";

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Give the schedule a name first.");
      return;
    }
    setPending(true);
    try {
      const preset = PRESETS[presetIndex];
      await createSchedule({
        serverId,
        name: name.trim(),
        action,
        commandPayload: needsPayload ? payload : undefined,
        scheduleDescription: isAdvanced ? `Cron: ${customCron}` : preset.description,
        cronExpression: isAdvanced ? customCron : preset.cron,
        timezone,
        enabled,
      });
      toast.success(`${name.trim()} created`);
      onCreated?.();
      setOpen(false);
      setName("");
      setPayload("");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> New Schedule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Schedule</DialogTitle>
          <DialogDescription>Automate recurring server actions.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="schedule-name">Name</Label>
            <Input id="schedule-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Daily Restart" />
          </div>

          <div className="space-y-1.5">
            <Label>Action</Label>
            <Select value={action} onValueChange={(v) => setAction(v as ScheduleAction)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {SCHEDULE_ACTION_LABEL[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsPayload && (
            <div className="space-y-1.5">
              <Label htmlFor="schedule-payload">{action === "command" ? "Command" : "Message"}</Label>
              <Input
                id="schedule-payload"
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                placeholder={action === "command" ? "save-all flush" : "say Server restarting soon!"}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Schedule</Label>
            <Select value={String(presetIndex)} onValueChange={(v) => setPresetIndex(Number(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p, i) => (
                  <SelectItem key={p.label} value={String(i)}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isAdvanced && (
            <div className="space-y-1.5">
              <Label htmlFor="cron">Cron expression</Label>
              <Textarea
                id="cron"
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
                rows={2}
                className="font-mono text-sm"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                <SelectItem value="Europe/London">Europe/London</SelectItem>
                <SelectItem value="America/New_York">America/New_York</SelectItem>
                <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label htmlFor="schedule-enabled" className="font-normal">
              Enabled
            </Label>
            <Switch id="schedule-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Create Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
