import type { PlatformUser, Role, RoleName } from "@/types";
import { api, mutation } from "@/lib/api";
import { useDataStore } from "@/stores/use-data-store";
export async function listUsers(): Promise<PlatformUser[]> { const { users } = await api<{ users: PlatformUser[] }>("/users"); useDataStore.setState({ users }); return users; }
export async function getUser(id: string): Promise<PlatformUser> { const { user } = await api<{ user: PlatformUser }>(`/users/${id}`); return user; }
export async function listRoles(): Promise<Role[]> { const { roles } = await api<{ roles: Role[] }>("/roles"); useDataStore.setState({ roles }); return roles; }
export async function getRole(id: string) { return (await listRoles()).find(r => r.id === id); }

export interface UpdateUserInput {
  name?: string;
  role?: RoleName;
  status?: "active" | "suspended";
  serverIds?: string[];
}
export async function updateUser(id: string, input: UpdateUserInput): Promise<PlatformUser> {
  const { user } = await api<{ user: PlatformUser }>(`/users/${id}`, mutation("PATCH", input));
  await listUsers();
  return user;
}
export async function deleteUser(id: string): Promise<void> {
  await api(`/users/${id}`, mutation("DELETE"));
  await listUsers();
}
