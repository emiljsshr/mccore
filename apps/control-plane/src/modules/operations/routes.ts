import type { FastifyInstance } from "fastify";
import { ApiError, ErrorCode } from "@mccore/contracts";
import { toOperationDto } from "./service.js";
export default async function operationRoutes(app: FastifyInstance) {
  app.get("/api/v1/operations/:id", { preHandler: app.authenticate }, async request => {
    const { id } = request.params as { id: string };
    const operation = await app.prisma.operation.findUnique({ where: { id } });
    if (!operation || (!request.user!.isSuperAdmin && operation.createdByUserId !== request.user!.id)) throw new ApiError(ErrorCode.NOT_FOUND, "Operation not found.");
    return { operation: toOperationDto(operation) };
  });
}
