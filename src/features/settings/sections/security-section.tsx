"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, mutation } from "@/lib/api";
import { useSessionStore } from "@/stores/use-session-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
interface Session { id: string; userAgent: string | null; ipAddress: string | null; current: boolean; }
export function SecuritySection() {
  const user = useSessionStore(s => s.user);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [setup, setSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pending, setPending] = useState(false);
  const refresh = async () => setSessions((await api<{ sessions: Session[] }>("/auth/sessions")).sessions);
  useEffect(() => { api<{ sessions: Session[] }>("/auth/sessions").then(data => setSessions(data.sessions)).catch(e => toast.error(e.message)); }, []);
  async function run(action: () => Promise<void>) { setPending(true); try { await action(); } catch(e) { toast.error((e as Error).message); } finally { setPending(false); } }
  return <div className="space-y-6">
    <Card><CardHeader><CardTitle>Two-Factor Authentication</CardTitle><CardDescription>{user?.totpEnabled ? "Enabled" : "Protect sign-in with an authenticator app."}</CardDescription></CardHeader><CardContent className="space-y-4">
      {!user?.totpEnabled && !setup && <Button disabled={pending} onClick={() => run(async () => setSetup(await api("/auth/2fa/setup", mutation("POST"))))}>Set up authenticator</Button>}
      {setup && <><img src={setup.qrDataUrl} alt="Authenticator setup QR code" width={200} height={200} /><p className="break-all font-mono text-sm">{setup.secret}</p></>}
      {(setup || user?.totpEnabled) && <><Input aria-label="Authenticator code" value={code} onChange={e => setCode(e.target.value)} autoComplete="one-time-code" placeholder="Authenticator code" /><Button disabled={pending || !code} onClick={() => run(async () => {
        const result = await api<{ recoveryCodes?: string[] }>(`/auth/2fa/${user?.totpEnabled ? "disable" : "enable"}`, mutation("POST", { code }));
        setCodes(result.recoveryCodes ?? []); setSetup(null); setCode("");
        if (user) useSessionStore.setState({ user: { ...user, totpEnabled: !user.totpEnabled } });
        toast.success("Two-factor authentication updated");
      })}>{user?.totpEnabled ? "Disable authenticator" : "Verify and enable"}</Button></>}
      {codes.length > 0 && <div><p>Save these recovery codes now. Each code works once.</p><pre className="mt-2 whitespace-pre-wrap">{codes.join("\n")}</pre></div>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Change Password</CardTitle></CardHeader><CardContent className="space-y-3"><Input aria-label="Current password" type="password" placeholder="Current password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" /><Input aria-label="New password" type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" /><Button disabled={pending} onClick={() => run(async () => { await api("/auth/change-password", mutation("POST", { currentPassword, newPassword })); setCurrentPassword(""); setNewPassword(""); await refresh(); toast.success("Password changed"); })}>Change Password</Button></CardContent></Card>
    <Card><CardHeader><CardTitle>Active Sessions</CardTitle></CardHeader><CardContent>{sessions.map(session => <div key={session.id} className="flex items-center justify-between gap-4 border-b py-3"><div className="min-w-0"><p className="truncate text-sm">{session.userAgent ?? "Unknown device"}</p><p className="text-xs text-muted-foreground">{session.ipAddress}</p></div>{session.current ? <span>This device</span> : <Button disabled={pending} variant="outline" onClick={() => run(async () => { await api(`/auth/sessions/${session.id}`, mutation("DELETE")); await refresh(); })}>Revoke</Button>}</div>)}</CardContent></Card>
  </div>;
}
