import type { Player, PlayerAchievement, PlayerBan } from "@mccore/database";
import type { PlayerDto } from "@mccore/contracts";
import { ApiError, ErrorCode } from "@mccore/contracts";

/**
 * §CRITICAL SECURITY RULE (players module): a `\n`/`\r` in any free-text
 * value that ends up inside a console command string sent to the agent
 * would effectively inject a second console command once it reaches the
 * Minecraft process's stdin. Every free-text value (ban/kick reason,
 * broadcast/tell message, etc.) must go through this before it's
 * concatenated into a command.
 */
export function assertNoNewlines(value: string, fieldName: string): void {
  if (/[\r\n]/.test(value)) {
    throw new ApiError(ErrorCode.VALIDATION_ERROR, `${fieldName} must not contain line breaks.`);
  }
}

/** A ban is currently enforced if it hasn't been pardoned and hasn't expired. */
export function isBanActive(ban: Pick<PlayerBan, "pardonedAt" | "expiresAt">, now = new Date()): boolean {
  if (ban.pardonedAt) return false;
  if (ban.expiresAt && ban.expiresAt <= now) return false;
  return true;
}

export interface PlayerDtoContext {
  online: boolean;
  serverId?: string;
  banned: boolean;
  banReason?: string;
  bannedBy?: string;
  whitelisted: boolean;
  operator: boolean;
  /** Omitted (defaults to []) by callers that list many players at once — fetched for the single-player detail route. */
  achievements?: PlayerAchievement[];
}

/**
 * Maps a `Player` row to the wire DTO.
 *
 * `inventory` is intentionally left `undefined` here — it's a live snapshot
 * requested on demand via the mcCore Bridge plugin (services/bridge-plugin,
 * see modules/players/invsee.ts), not something read from the database, so
 * it doesn't belong in a plain row-to-DTO mapper.
 *
 * `gameMode` has no backing column on `Player` or `PlayerSession` (it's
 * per-life client state, not something the control plane persists) and the
 * DTO field is non-optional, so this defaults to `"survival"` as a
 * placeholder until an inventory snapshot (which does report it) has been
 * taken. Judgment call — flagged in the module's implementation report.
 */
export function toPlayerDto(player: Player, ctx: PlayerDtoContext): PlayerDto {
  return {
    id: player.id,
    uuid: player.uuid,
    username: player.username,
    avatarSeed: player.avatarSeed,
    online: ctx.online,
    serverId: ctx.serverId,
    gameMode: "survival",
    playtimeSeconds: player.playtimeSeconds,
    firstJoined: player.firstSeenAt.toISOString(),
    lastSeen: player.lastSeenAt.toISOString(),
    banned: ctx.banned,
    banReason: ctx.banReason,
    bannedBy: ctx.bannedBy,
    whitelisted: ctx.whitelisted,
    operator: ctx.operator,
    achievements: (ctx.achievements ?? []).map((a) => ({
      key: a.key,
      title: a.title,
      description: a.description,
      serverId: a.serverId,
      earnedAt: a.earnedAt.toISOString(),
    })),
    // inventory intentionally omitted — see doc comment above.
  };
}
