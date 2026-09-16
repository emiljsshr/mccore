import type { ApiKey as ApiKeyRow } from "@mccore/database";
import type { ApiKeyDto } from "@mccore/contracts";

export function toApiKeyDto(row: ApiKeyRow): ApiKeyDto {
  return {
    id: row.id,
    label: row.label,
    scopes: row.scopes as ApiKeyDto["scopes"],
    keyPreview: row.keyPreview,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? undefined,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? undefined,
    revokedAt: row.revokedAt?.toISOString() ?? undefined,
  };
}
