import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { recordAudit } from "../audit/service.js";

const UpdateSettingsSchema = z.record(z.string(), z.unknown());

export default async function settingsRoutes(app: FastifyInstance) {
  app.get("/api/v1/settings", { preHandler: app.requirePermission("settings.view") }, async () => {
    const rows = await app.prisma.systemSetting.findMany();
    const settings: Record<string, unknown> = {};
    for (const row of rows) settings[row.key] = row.value;
    return { settings };
  });

  app.patch("/api/v1/settings", { preHandler: app.requirePermission("settings.manage") }, async (request) => {
    const input = UpdateSettingsSchema.parse(request.body);
    const keys = Object.keys(input);

    await Promise.all(
      keys.map((key) =>
        app.prisma.systemSetting.upsert({
          where: { key },
          update: { value: input[key] as never, updatedByUserId: request.user!.id },
          create: { key, value: input[key] as never, updatedByUserId: request.user!.id },
        })
      )
    );

    // §45: never record full values in the audit trail for keys that look
    // secret-ish — simplest safe policy is to never record values at all
    // here, only the set of changed key names.
    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "settings.updated",
      description: `${request.user!.name} updated settings: ${keys.join(", ") || "(no keys)"}.`,
      targetType: "settings",
      severity: "INFO",
      ipAddress: request.ip,
      metadata: { changedKeys: keys },
    });

    const rows = await app.prisma.systemSetting.findMany();
    const settings: Record<string, unknown> = {};
    for (const row of rows) settings[row.key] = row.value;
    return { settings };
  });
}
