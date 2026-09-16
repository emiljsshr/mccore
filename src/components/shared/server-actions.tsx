"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Play,
  Square,
  RotateCw,
  Zap,
  Copy,
  Settings,
  Trash2,
  ExternalLink,
  MoreHorizontal,
  Loader2,
} from "@/lib/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { Server } from "@/types";
import {
  deleteServer,
  duplicateServer,
  killServer,
  restartServer,
  startServer,
  stopServer,
} from "@/services";

interface ServerActionsProps {
  server: Server;
  variant?: "menu" | "buttons";
  onChanged?: () => void;
}

export function ServerActions({ server, variant = "menu", onChanged }: ServerActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [confirmKill, setConfirmKill] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isBusy =
    isPending ||
    server.status === "starting" ||
    server.status === "stopping" ||
    server.status === "restarting" ||
    server.status === "installing";

  function run(action: string, fn: () => Promise<unknown>, successMessage: string) {
    setPendingAction(action);
    startTransition(async () => {
      try {
        await fn();
        toast.success(successMessage);
        onChanged?.();
      } catch {
        toast.error("Action failed. Please try again.");
      } finally {
        setPendingAction(null);
      }
    });
  }

  const handleStart = () => run("start", () => startServer(server.id), `${server.name} is starting`);
  const handleStop = () => run("stop", () => stopServer(server.id), `${server.name} stopped`);
  const handleRestart = () => run("restart", () => restartServer(server.id), `${server.name} restarted`);
  const handleKill = () =>
    run("kill", () => killServer(server.id), `${server.name} was force-killed`);
  const handleDuplicate = () =>
    run("duplicate", async () => {
      const copy = await duplicateServer(server.id);
      if (copy) router.push(`/servers/${copy.id}`);
    }, `${server.name} duplicated`);
  const handleDelete = () =>
    run("delete", async () => {
      await deleteServer(server.id);
      router.push("/servers");
    }, `${server.name} deleted`);

  if (variant === "buttons") {
    return (
      <>
        <div className="flex flex-wrap items-center gap-2">
          {server.status === "offline" || server.status === "error" ? (
            <Button onClick={handleStart} disabled={isBusy}>
              {pendingAction === "start" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              Start
            </Button>
          ) : (
            <Button variant="secondary" onClick={handleStop} disabled={isBusy}>
              {pendingAction === "stop" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Square className="size-4" />
              )}
              Stop
            </Button>
          )}
          <Button variant="outline" onClick={handleRestart} disabled={isBusy}>
            {pendingAction === "restart" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCw className="size-4" />
            )}
            Restart
          </Button>
          <Button
            variant="outline"
            className="text-status-critical hover:bg-status-critical-muted hover:text-status-critical"
            onClick={() => setConfirmKill(true)}
            disabled={isBusy}
          >
            <Zap className="size-4" />
            Kill
          </Button>
        </div>

        <ConfirmDialog
          open={confirmKill}
          onOpenChange={setConfirmKill}
          title={`Force kill ${server.name}?`}
          description="This immediately terminates the Minecraft process without saving. Unsaved world data may be lost."
          confirmLabel="Force Kill"
          destructive
          onConfirm={handleKill}
        />
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={(e) => e.stopPropagation()}
          >
            {isBusy ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
            <span className="sr-only">Server actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => router.push(`/servers/${server.id}`)}>
            <ExternalLink /> Open
          </DropdownMenuItem>
          {server.status === "offline" || server.status === "error" ? (
            <DropdownMenuItem onClick={handleStart} disabled={isBusy}>
              <Play /> Start
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={handleStop} disabled={isBusy}>
              <Square /> Stop
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleRestart} disabled={isBusy}>
            <RotateCw /> Restart
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDuplicate} disabled={isBusy}>
            <Copy /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`/servers/${server.id}/settings`)}>
            <Settings /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${server.name}?`}
        description="This permanently deletes the server, its worlds, plugins and configuration. This action cannot be undone."
        confirmLabel="Delete Server"
        destructive
        confirmationValue={server.name}
        onConfirm={handleDelete}
      />
    </>
  );
}
