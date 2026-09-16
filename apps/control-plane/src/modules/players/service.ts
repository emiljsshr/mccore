import type { Player, PlayerBan } from "@mccore/database";
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
}

/**
 * Maps a `Player` row to the wire DTO.
 *
 * `inventory` is intentionally left `undefined` — reading live inventory
 * contents requires the not-yet-built "mcCore Bridge" plugin integration
 * (see docs/architecture.md), which this module doesn't depend on.
 *
 * `gameMode` has no backing column on `Player` or `PlayerSession` (it's
 * per-life client state, not something the control plane persists) and the
 * DTO field is non-optional, so this defaults to `"survival"` as a
 * placeholder until the mcCore Bridge can report the player's live game
 * mode. Judgment call — flagged in the module's implementation report.
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
    // inventory intentionally omitted — see doc comment above.
  };
}
