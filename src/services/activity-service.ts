import type { AuditEvent } from "@/types";
import { api } from "@/lib/api";
import { useDataStore } from "@/stores/use-data-store";
export async function listActivity(): Promise<AuditEvent[]> { const data = await api<{ events: AuditEvent[] }>("/audit"); useDataStore.setState({ activity: data.events }); return data.events; }
