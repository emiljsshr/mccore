"use client";

import Link from "next/link";
import { HelpCircle, LogOut, Settings, User } from "@/lib/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlayerAvatar } from "@/components/shared/player-avatar";
import { useSessionStore } from "@/stores/use-session-store";
import { api, mutation } from "@/lib/api";
import { toast } from "sonner";



export function HeaderUserMenu() {
  const currentUser = useSessionStore(s => s.user);
  if (!currentUser) return null;
  async function logout() { try { await api("/auth/logout", mutation("POST")); useSessionStore.setState({ user: null }); window.location.assign("/login"); } catch(e) { toast.error((e as Error).message); } }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-full py-1 pl-3 pr-3 text-left border border-border bg-background transition-colors hover:bg-hover"
        >
          <PlayerAvatar seed={currentUser.avatarSeed} size="sm" square={false} />
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-xs font-semibold text-foreground">
              {currentUser.name}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">Administrator</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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
