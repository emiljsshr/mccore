import type { PlatformUser, Role } from "@/types";
import { api } from "@/lib/api";
import { useDataStore } from "@/stores/use-data-store";
export async function listUsers(): Promise<PlatformUser[]> { const { users } = await api<{ users: PlatformUser[] }>("/users"); useDataStore.setState({ users }); return users; }
export async function listRoles(): Promise<Role[]> { const { roles } = await api<{ roles: Role[] }>("/roles"); useDataStore.setState({ roles }); return roles; }
export async function getRole(id: string) { return (await listRoles()).find(r => r.id === id); }
