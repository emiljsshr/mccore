import fp from "fastify-plugin";
import type { FastifyInstance, FastifyError } from "fastify";
import { ZodError } from "zod";
import { ApiError, ErrorCode, httpStatusForErrorCode } from "@mccore/contracts";

/**
 * §49: uniform `{ error: { code, message, requestId } }` shape, never a
 * stack trace to the client in production. Zod validation failures become
 * `VALIDATION_ERROR` with the first issue's message; anything unexpected
 * becomes `INTERNAL_ERROR` with a generic message (the real error is still
 * logged server-side with the requestId for correlation, per §51).
 */
export default fp(async function errorHandler(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError | ApiError, request, reply) => {
    const requestId = request.id;

    if (err instanceof ApiError) {
      request.log.warn({ err, requestId, code: err.code }, "request failed");
      return reply.status(err.status).send({
        error: { code: err.code, message: err.message, requestId, details: err.details },
      });
    }

    if (err instanceof ZodError) {
      const first = err.issues[0];
      request.log.info({ err, requestId }, "validation error");
      return reply.status(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: first ? `${first.path.join(".") || "value"}: ${first.message}` : "Invalid request.",
          requestId,
        },
      });
    }

    // Fastify's own schema-validation errors carry a `validation` array.
    if ((err as { validation?: unknown }).validation) {
      request.log.info({ err, requestId }, "schema validation error");
      return reply.status(400).send({
        error: { code: ErrorCode.VALIDATION_ERROR, message: err.message, requestId },
      });
    }

    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
    if (status >= 500) {
      request.log.error({ err, requestId }, "unhandled error");
    } else {
      request.log.info({ err, requestId }, "request error");
    }

    const code = status === 429 ? ErrorCode.RATE_LIMITED : ErrorCode.INTERNAL_ERROR;
    reply.status(status >= 500 ? httpStatusForErrorCode(ErrorCode.INTERNAL_ERROR) : status).send({
      error: {
        code,
        message: status >= 500 ? "Internal server error." : err.message,
        requestId,
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: { code: ErrorCode.NOT_FOUND, message: "Route not found.", requestId: request.id },
    });
  });
});
