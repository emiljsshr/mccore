import type { McNetwork } from "@/types";
import { api } from "@/lib/api";
import { useDataStore } from "@/stores/use-data-store";
export async function listNetworks(): Promise<McNetwork[]> { const data = await api<{ networks: McNetwork[] }>("/networks"); useDataStore.setState({ networks: data.networks }); return data.networks; }
export async function getNetwork(id: string): Promise<McNetwork | undefined> { return (await listNetworks()).find(item => item.id === id); }
