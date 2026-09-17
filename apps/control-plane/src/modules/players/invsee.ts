import fp from "fastify-plugin";

/**
 * Correlates an "invsee" request with the mcCore Bridge plugin's console
 * response for it. There's no request/response channel to the Agent beyond
 * fire-and-forget commands and events (§ mcCore Bridge design), so this is
 * the piece that turns "send a console command, then wait for some later
 * event carrying the same requestId" into a plain awaitable promise for
 * the route handler.
 */
export interface InvseeRegistry {
  /** Registers a pending request; resolves with the Bridge's payload, or rejects on timeout. */
  register(requestId: string, timeoutMs?: number): Promise<Record<string, unknown>>;
  /** Called by the event dispatcher when a matching [MCBRIDGE] inventory line arrives. */
  resolve(requestId: string, payload: Record<string, unknown>): void;
}

declare module "fastify" {
  interface FastifyInstance {
    invsee: InvseeRegistry;
  }
}

const DEFAULT_TIMEOUT_MS = 8_000;

export default fp(async function invseePlugin(app) {
  const pending = new Map<string, { resolve: (payload: Record<string, unknown>) => void; timer: NodeJS.Timeout }>();

  function register(requestId: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error("Timed out waiting for the server to respond. Is the mcCore Bridge plugin installed and the server online?"));
      }, timeoutMs);
      pending.set(requestId, { resolve, timer });
    });
  }

  function resolve(requestId: string, payload: Record<string, unknown>): void {
    const entry = pending.get(requestId);
    if (!entry) return; // Already timed out, or a stray/duplicate line — safe to drop.
    clearTimeout(entry.timer);
    pending.delete(requestId);
    entry.resolve(payload);
  }

  app.decorate("invsee", { register, resolve } satisfies InvseeRegistry);
  app.addHook("onClose", async () => {
    for (const [, entry] of pending) clearTimeout(entry.timer);
    pending.clear();
  });
});
