import fp from "fastify-plugin";

/**
 * Correlates a "worldstats" request with the mcCore Bridge plugin's console
 * response for it — the exact same pattern as modules/players/invsee.ts
 * (see that file for why this shape exists at all: there's no
 * request/response channel to the Agent beyond fire-and-forget commands and
 * events, so this turns "send a console command, then wait for some later
 * event carrying the same requestId" into a plain awaitable promise for the
 * route handler). Kept as its own registry rather than reusing `app.invsee`
 * — the payload shapes are unrelated, and a shared generic registry would
 * blur which module owns which timeout/error semantics for no real gain.
 */
export interface WorldStatsRegistry {
  /** Registers a pending request; resolves with the Bridge's payload, or rejects on timeout. */
  register(requestId: string, timeoutMs?: number): Promise<Record<string, unknown>>;
  /** Called by the event dispatcher when a matching [MCBRIDGE] worldstats line arrives. */
  resolve(requestId: string, payload: Record<string, unknown>): void;
}

declare module "fastify" {
  interface FastifyInstance {
    worldStats: WorldStatsRegistry;
  }
}

const DEFAULT_TIMEOUT_MS = 8_000;

export default fp(async function worldStatsPlugin(app) {
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

  app.decorate("worldStats", { register, resolve } satisfies WorldStatsRegistry);
  app.addHook("onClose", async () => {
    for (const [, entry] of pending) clearTimeout(entry.timer);
    pending.clear();
  });
});
