import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma } from "@mccore/database";
import { ApiError, ErrorCode, ulid, EnrollExchangeRequestSchema } from "@mccore/contracts";
import { toNodeDto, listNodesWithCounts } from "./service.js";
import { recordAudit } from "../audit/service.js";
import { randomToken, sha256Hex } from "../../lib/tokens.js";

const CreateEnrollmentTokenSchema = z.object({ label: z.string().trim().min(1).max(64) });
const UpdateNodeSchema = z.object({ name: z.string().trim().min(1).max(64).optional(), location: z.string().trim().max(96).optional() });

export default async function nodesRoutes(app: FastifyInstance) {
  app.get("/api/v1/nodes", { preHandler: app.requirePermission("nodes.view") }, async () => {
    return { nodes: await listNodesWithCounts(app.prisma) };
  });

  app.get("/api/v1/nodes/:id", { preHandler: app.requirePermission("nodes.view") }, async (request) => {
    const { id } = request.params as { id: string };
    const node = await app.prisma.node.findUnique({ where: { id } });
    if (!node) throw new ApiError(ErrorCode.NODE_NOT_FOUND, "Node not found.");
    const serverCount = await app.prisma.minecraftServer.count({ where: { nodeId: id, deletedAt: null } });
    return { node: toNodeDto({ ...node, serverCount }), connected: app.agentHub.isConnected(id) };
  });

  app.patch("/api/v1/nodes/:id", { preHandler: app.requirePermission("nodes.manage") }, async (request) => {
    const { id } = request.params as { id: string };
    const input = UpdateNodeSchema.parse(request.body);
    const node = await app.prisma.node.update({ where: { id }, data: input }).catch(() => null);
    if (!node) throw new ApiError(ErrorCode.NODE_NOT_FOUND, "Node not found.");
    return { node: toNodeDto(node) };
  });

  app.delete("/api/v1/nodes/:id", { preHandler: app.requirePermission("nodes.delete") }, async (request) => {
    const { id } = request.params as { id: string };
    const serverCount = await app.prisma.minecraftServer.count({ where: { nodeId: id, deletedAt: null } });
    if (serverCount > 0) {
      throw new ApiError(ErrorCode.CONFLICT, "Cannot remove a node that still has servers on it.");
    }
    await app.prisma.node.delete({ where: { id } }).catch(() => {
      throw new ApiError(ErrorCode.NODE_NOT_FOUND, "Node not found.");
    });
    await recordAudit(app.prisma, {
      actorUserId: request.user!.id,
      action: "node.removed",
      description: `${request.user!.name} removed a node.`,
      targetType: "node",
      resourceId: id,
      severity: "WARNING",
      ipAddress: request.ip,
    });
    return { ok: true };
  });

  // §16: one-time enrollment token, shown once in the "Add Node" install command.
  app.post(
    "/api/v1/nodes/enrollment-tokens",
    { preHandler: app.requirePermission("nodes.create"), config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const { label } = CreateEnrollmentTokenSchema.parse(request.body);
      const token = randomToken(32);
      const record = await app.prisma.enrollmentToken.create({
        data: {
          id: ulid(),
          label,
          tokenHash: sha256Hex(token),
          createdByUserId: request.user!.id,
          expiresAt: new Date(Date.now() + app.config.enrollmentTtlMs),
        },
      });
      await recordAudit(app.prisma, {
        actorUserId: request.user!.id,
        action: "node.enrollment_token_created",
        description: `${request.user!.name} generated a node enrollment token ("${label}").`,
        targetType: "node",
        severity: "INFO",
        ipAddress: request.ip,
      });
      return {
        id: record.id,
        label: record.label,
        token,
        createdAt: record.createdAt.toISOString(),
        expiresAt: record.expiresAt.toISOString(),
        installCommand: `curl -fsSL ${app.config.PUBLIC_URL}/install.sh | sudo bash -s -- --control-plane ${app.config.CONTROL_PLANE_URL} --token ${token}`,
      };
    }
  );

  // Unauthenticated: the enrollment token itself is the credential. Heavily
  // rate-limited since this is the one Node-facing endpoint reachable
  // without any prior trust relationship.
  app.post(
    "/api/v1/nodes/enroll",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request) => {
      const input = EnrollExchangeRequestSchema.parse(request.body);
      const tokenHash = sha256Hex(input.enrollmentToken);

      const node = await app.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const record = await tx.enrollmentToken.findUnique({ where: { tokenHash } });
        if (!record) throw new ApiError(ErrorCode.ENROLLMENT_TOKEN_INVALID, "Invalid enrollment token.");
        if (record.usedAt) throw new ApiError(ErrorCode.ENROLLMENT_TOKEN_USED, "Enrollment token has already been used.");
        if (record.expiresAt < new Date()) throw new ApiError(ErrorCode.ENROLLMENT_TOKEN_EXPIRED, "Enrollment token has expired.");

        const nodeId = ulid();
        const created = await tx.node.create({
          data: {
            id: nodeId,
            name: record.label,
            hostname: input.hostname,
            os: input.os,
            kernel: input.kernel,
            arch: input.arch,
            cpuModel: input.cpuModel,
            cpuCores: input.cpuCores,
            memoryTotalMb: input.memoryTotalMb,
            diskTotalMb: input.diskTotalMb,
            ipAddress: input.ipAddress,
            agentVersion: input.agentVersion,
            protocolVersion: input.protocolVersion,
            javaInstallations: input.javaInstallations as never,
            status: "OFFLINE",
          },
        });
        await tx.nodeCredential.create({ data: { id: ulid(), nodeId, publicKey: input.publicKey } });
        await tx.enrollmentToken.update({ where: { id: record.id }, data: { usedAt: new Date(), nodeId } });
        return created;
      });

      await recordAudit(app.prisma, {
        actorIsSystem: true,
        action: "node.enrolled",
        description: `Node "${node.name}" (${input.hostname}) enrolled.`,
        targetType: "node",
        resourceId: node.id,
        severity: "SUCCESS",
        ipAddress: request.ip,
      });

      return { nodeId: node.id, nodeName: node.name };
    }
  );
}
