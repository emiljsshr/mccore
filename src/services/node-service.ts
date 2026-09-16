import type { McNode } from "@/types";
import { api } from "@/lib/api";
import { useDataStore } from "@/stores/use-data-store";
export async function listNodes(): Promise<McNode[]> { const data = await api<{ nodes: McNode[] }>("/nodes"); useDataStore.setState({ nodes: data.nodes }); return data.nodes; }
export async function getNode(id: string): Promise<McNode | undefined> { return (await listNodes()).find(item => item.id === id); }
