import type { FastifyInstance } from "fastify";
import { ApiError, ErrorCode } from "@mccore/contracts";
import { toNotificationDto } from "./service.js";

const MAX_NOTIFICATIONS = 100;

export default async function notificationsRoutes(app: FastifyInstance) {
  app.get("/api/v1/notifications", { preHandler: app.authenticate }, async (request) => {
    const rows = await app.prisma.notification.findMany({
      where: { AND: [ { OR: [{ userId: request.user!.id }, { userId: null }] }, ...(request.user!.serverIds === null ? [] : [{ OR: [{ serverId: null }, { serverId: { in: request.user!.serverIds } }] }]) ] },
      orderBy: { createdAt: "desc" },
      take: MAX_NOTIFICATIONS,
    });
    return { notifications: rows.map(toNotificationDto) };
  });

  app.post("/api/v1/notifications/:id/read", { preHandler: app.authenticate }, async (request) => {
    const { id } = request.params as { id: string };
    const notification = await app.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new ApiError(ErrorCode.NOT_FOUND, "Notification not found.");

    // §46 / V1 limitation: broadcast notifications (`userId: null`) have no
    // per-user read-state in the schema yet, so they can't be individually
    // dismissed. This is a real, documented gap — not something to fake by
    // silently no-op'ing or mutating the shared row for every viewer.
    if (notification.userId === null) {
      throw new ApiError(ErrorCode.FORBIDDEN, "Broadcast notifications can't be individually dismissed yet.");
    }
    if (notification.userId !== request.user!.id) {
      throw new ApiError(ErrorCode.NOT_FOUND, "Notification not found.");
    }

    const updated = await app.prisma.notification.update({ where: { id }, data: { read: true } });
    return { notification: toNotificationDto(updated) };
  });

  app.post("/api/v1/notifications/read-all", { preHandler: app.authenticate }, async (request) => {
    const result = await app.prisma.notification.updateMany({
      where: { userId: request.user!.id, read: false },
      data: { read: true },
    });
    return { ok: true, count: result.count };
  });
}
