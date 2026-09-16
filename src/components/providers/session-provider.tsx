"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUserDto } from "@mccore/contracts";
import { api, ApiRequestError } from "@/lib/api";
import { startLive, stopLive, subscribeLive, onLiveReconnect } from "@/lib/live";
import { useSessionStore } from "@/stores/use-session-store";
import { useServerStore } from "@/stores/use-server-store";
import { useDataStore } from "@/stores/use-data-store";
import { listBackups } from "@/services/backup-service";
import { listSchedules } from "@/services/schedule-service";
import { listPlayers } from "@/services/player-service";
import { listInstalledPlugins } from "@/services/plugin-service";
import { listServers } from "@/services/server-service";
import { listNodes } from "@/services/node-service";
import { listNetworks } from "@/services/network-service";
import { listUsers, listRoles } from "@/services/user-service";
import { listNotifications } from "@/services/notification-service";
import { listActivity } from "@/services/activity-service";
import { Button } from "@/components/ui/button";

export function SessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loadedUser, setLoadedUser] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const user = useSessionStore(s => s.user);
  const serverIds = useServerStore(s => s.servers.map(server => server.id).join(","));
  useEffect(() => {
    if (!user) return;
    const subscriptions = serverIds.split(",").filter(Boolean).map(id => subscribeLive(`server:${id}`, () => {}));
    return () => subscriptions.forEach(unsubscribe => unsubscribe());
  }, [serverIds, user]);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { complete } = await api<{ complete: boolean }>("/setup/status");
        if (!active) return;
        if (!complete) { if (pathname !== "/setup") router.replace("/setup"); setReady(true); return; }
        if (pathname === "/setup") { router.replace("/login"); return; }
        try {
          const { user } = await api<{ user: SessionUserDto }>("/auth/session");
          if (!active) return;
          useSessionStore.setState({ user });
          if (["/login", "/forgot-password"].includes(pathname)) router.replace("/dashboard");
        } catch (e) {
          if (!(e instanceof ApiRequestError) || e.status !== 401) throw e;
          useSessionStore.setState({ user: null });
          if (!["/login", "/forgot-password", "/reset-password"].includes(pathname)) router.replace("/login");
        }
        setReady(true); setError("");
      } catch (e) { if (active) setError((e as Error).message); }
    }
    void load();
    const expired = () => { useSessionStore.setState({ user: null }); router.replace("/login"); };
    window.addEventListener("mccore:unauthorized", expired);
    return () => { active = false; window.removeEventListener("mccore:unauthorized", expired); };
  }, [pathname, router, retry]);
  useEffect(() => {
    if (!user) { stopLive(); useServerStore.setState({ servers: [] }); useDataStore.setState({ nodes: [], networks: [], users: [], roles: [], activity: [] }); return; }
    let active = true;
    const allowed = (p: string) => user.isSuperAdmin || user.permissions.includes(p);
    async function refresh() {
      const results = await Promise.allSettled([
        ...(allowed("server.view") ? [listServers(), listNetworks()] : []),
        ...(allowed("nodes.view") ? [listNodes()] : []),
        ...(allowed("audit.view") ? [listActivity()] : []),
        ...(allowed("users.view") ? [listUsers(), listRoles()] : []),
        listNotifications(),
        ...(allowed("players.view") ? [listPlayers()] : []),
      ]);
      if (active && !results.some(r => r.status === "rejected")) {
        const ids = useServerStore.getState().servers.map(server => server.id);
        const detailResults = await Promise.allSettled([
          ...(allowed("backups.view") ? ids.map(listBackups) : []),
          ...(allowed("schedules.view") ? ids.map(listSchedules) : []),
          ...(allowed("plugins.view") ? [listInstalledPlugins()] : []),
        ]);
        for (const result of detailResults) if (result.status === "rejected") console.error("Could not refresh server details", result.reason);
      }
      if (active) {
        setLoadedUser(user!.id);
        const failure = results.find(r => r.status === "rejected");
        if (failure?.status === "rejected") setError(failure.reason instanceof Error ? failure.reason.message : "Could not refresh data.");
      }
    }
    void refresh();
    const unsubscribe = subscribeLive("global", event => { if (["node.status", "server.status", "backup.progress", "plugin.install.progress", "notification.created"].includes(event.type)) void refresh(); });
    const reconnect = onLiveReconnect(() => { void refresh(); });
    startLive();
    const poll = setInterval(() => { void refresh(); }, 15000);
    return () => { active = false; clearInterval(poll); unsubscribe(); reconnect(); stopLive(); };
  }, [user]);
  if (error) return <div className="m-auto max-w-lg space-y-4 p-8"><h1 className="text-xl font-semibold">Connection to mcCore failed</h1><p role="alert">{error}</p><Button onClick={() => { setError(""); setRetry(n => n + 1); }}>Retry</Button></div>;
  const publicPage = ["/setup", "/login", "/forgot-password", "/reset-password"].includes(pathname);
  if (!ready || (!publicPage && (!user || loadedUser !== user.id))) return <p className="m-auto p-8 text-muted-foreground">Connecting to mcCore…</p>;
  return children;
}
