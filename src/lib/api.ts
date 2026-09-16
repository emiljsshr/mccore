export class ApiRequestError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`/api/v1${path}`, { ...options, headers, credentials: "same-origin", cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/") && typeof window !== "undefined") {
      window.dispatchEvent(new Event("mccore:unauthorized"));
    }
    throw new ApiRequestError(data?.error?.code ?? "REQUEST_FAILED", data?.error?.message ?? `Request failed (${response.status})`, response.status);
  }
  return data as T;
}

export function mutation(method: string, body?: unknown, idempotent = false): RequestInit {
  return { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(idempotent ? { headers: { "Idempotency-Key": crypto.randomUUID() } } : {}) };
}
