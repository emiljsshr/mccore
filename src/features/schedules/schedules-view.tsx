"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useScheduleStore } from "@/stores/use-schedule-store";
import { useServerStore } from "@/stores/use-server-store";
import { ScheduleEditorDialog } from "@/features/schedules/schedule-editor-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SCHEDULE_ACTION_LABEL } from "@/types";
import type { Schedule } from "@/types";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { deleteSchedule, toggleSchedule } from "@/services";
import { CalendarClock, Trash2 } from "@/lib/icons";

export function SchedulesView({ serverId }: { serverId?: string }) {
  const allSchedules = useScheduleStore((s) => s.schedules);
  const servers = useServerStore((s) => s.servers);
  const schedules = serverId ? allSchedules.filter((s) => s.serverId === serverId) : allSchedules;
  const [toDelete, setToDelete] = useState<Schedule | null>(null);

  function serverName(id: string) {
    return servers.find((s) => s.id === id)?.name ?? id;
  }

  async function handleDelete() {
    if (!toDelete) return;
    await deleteSchedule(toDelete.id);
    toast.success(`${toDelete.name} deleted`);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ScheduleEditorDialog serverId={serverId ?? servers[0]?.id} />
      </div>

      {schedules.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No schedules yet"
          description="Automate restarts, backups and commands by creating a schedule."
        />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-surface">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{schedule.name}</p>
                  <Badge variant="secondary" className="text-[10px]">
                    {SCHEDULE_ACTION_LABEL[schedule.action]}
                  </Badge>
                  {!serverId && (
                    <Badge variant="outline" className="text-[10px]">
                      {serverName(schedule.serverId)}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{schedule.scheduleDescription}</p>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="text-right">
                  <p>Next run</p>
                  <p className="font-medium text-foreground">{formatDateTime(schedule.nextRun)}</p>
                </div>
                {schedule.lastRun && (
                  <div className="hidden text-right sm:block">
                    <p>Last run</p>
                    <p className="font-medium text-foreground">{formatRelativeTime(schedule.lastRun)}</p>
                  </div>
                )}
                <Switch
                  checked={schedule.enabled}
                  onCheckedChange={() => {
                    toggleSchedule(schedule.id);
                    toast.success(`${schedule.name} ${schedule.enabled ? "disabled" : "enabled"}`);
                  }}
                />
                <Button variant="ghost" size="icon-sm" onClick={() => setToDelete(schedule)}>
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Delete "${toDelete?.name}"?`}
        description="This schedule will no longer run."
        confirmLabel="Delete Schedule"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
