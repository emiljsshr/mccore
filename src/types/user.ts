import type { RoleName } from "./permission";

export type UserStatus = "active" | "invited" | "suspended";

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  avatarSeed: string;
  role: RoleName;
  serverIds: string[];
  lastActive: string;
  status: UserStatus;
  createdAt: string;
}
