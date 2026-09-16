"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlayerAvatar } from "@/components/shared/player-avatar";
import { cn } from "@/lib/utils";
import { HelpCircle, LogOut, MoreVertical, Settings, User } from "@/lib/icons";
import Link from "next/link";
import { useSessionStore } from "@/stores/use-session-store";
import { api, mutation } from "@/lib/api";
import { toast } from "sonner";



export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const currentUser = useSessionStore(s => s.user);
  if (!currentUser) return null;
  async function logout() { try { await api("/auth/logout", mutation("POST")); useSessionStore.setState({ user: null }); window.location.assign("/login"); } catch(e) { toast.error((e as Error).message); } }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/5",
            collapsed && "justify-center px-0",
          )}
        >
          <PlayerAvatar seed={currentUser.avatarSeed} size="sm" square={false} />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-white">
                  {currentUser.name}
                </span>
                <span className="block truncate text-[11px] text-white/40">
                  Administrator
                </span>
              </span>
              <MoreVertical className="size-3.5 shrink-0 text-white/40" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{currentUser.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{currentUser.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <User /> Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/help">
            <HelpCircle /> Help
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" asChild>
          <button onClick={logout}><LogOut /> Sign out</button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
