"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { KeyRound, Plus, Trash2 } from "@/lib/icons";
import { formatRelativeTime } from "@/lib/format";
import { api, mutation } from "@/lib/api";
import type { ApiKeyDto } from "@mccore/contracts";

interface ApiKey {
  id: string;
  name: string;
  createdAt: string;
  lastUsed: string | null;
  prefix: string;
}

export function ApiSection() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [toRevoke, setToRevoke] = useState<ApiKey | null>(null);

  const [secret, setSecret] = useState("");
  async function refresh() { const { apiKeys } = await api<{ apiKeys: ApiKeyDto[] }>("/api-keys"); setKeys(apiKeys.filter(k => !k.revokedAt).map(k => ({ id: k.id, name: k.label, prefix: k.keyPreview, createdAt: k.createdAt, lastUsed: k.lastUsedAt ?? null }))); }
  useEffect(() => { api<{ apiKeys: ApiKeyDto[] }>("/api-keys").then(({ apiKeys }) => setKeys(apiKeys.filter(k => !k.revokedAt).map(k => ({ id: k.id, name: k.label, prefix: k.keyPreview, createdAt: k.createdAt, lastUsed: k.lastUsedAt ?? null })))).catch(e => toast.error(e.message)); }, []);
  async function handleGenerate() {
    try { const { rawKey } = await api<{ rawKey: string }>("/api-keys", mutation("POST", { label: "Read-only API key", scopes: ["server:read"], expiresInDays: 30 })); setSecret(rawKey); await refresh(); }
    catch(e) { toast.error((e as Error).message); }
  }
  async function handleRevoke() {
    if (!toRevoke) return;
    await api(`/api-keys/${toRevoke.id}`, mutation("DELETE")); await refresh(); toast.success("API key revoked");
  }

  return (
    <>
      {secret && <Card><CardContent className="space-y-2"><p>Copy this read-only key now. It expires in 30 days and is shown only once.</p><code className="block break-all">{secret}</code><Button onClick={() => setSecret("")}>I saved this key</Button></CardContent></Card>}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">API Keys</CardTitle>
            <CardDescription>Used to authenticate requests to the Cometa mcCore API.</CardDescription>
          </div>
          <Button size="sm" onClick={handleGenerate}>
            <Plus className="size-3.5" /> Generate Key
          </Button>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <KeyRound className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">{key.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{key.prefix}••••••••••••</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-[10px]">
                  {key.lastUsed ? `Used ${formatRelativeTime(key.lastUsed)}` : "Never used"}
                </Badge>
                <Button variant="ghost" size="icon-sm" onClick={() => setToRevoke(key)}>
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(toRevoke)}
        onOpenChange={(open) => !open && setToRevoke(null)}
        title={`Revoke "${toRevoke?.name}"?`}
        description="Any integration using this key will immediately lose access."
        confirmLabel="Revoke Key"
        destructive
        onConfirm={handleRevoke}
      />
    </>
  );
}
