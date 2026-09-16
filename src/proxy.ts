import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// §9: mcCore Next.js 16 renamed `middleware.ts` -> `proxy.ts` (the
// `middleware` file convention is deprecated as of Next 16 — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
// Exported function must be named `proxy`, not `middleware`.
//
// This is the *first*, cheap line of defense only — it decides "should
// this request see a page at all" using just the presence of the session
// cookie and a cached setup-status flag. It deliberately does NOT try to
// fully validate the session here (Proxy's own docs warn against relying
// on it as the sole auth boundary — see the "Good to know" callout in the
// file linked above): every real data-fetching call still goes through
// the Control Plane's `app.authenticate`/`requirePermission` checks on
// every request, which is the actual authorization boundary.

const CONTROL_PLANE_URL = (process.env.CONTROL_PLANE_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const SESSION_COOKIE = "mccore_session"; // apps/control-plane/src/config.ts `cookieName`

const SETUP_PATH = "/setup";
const AUTH_EXEMPT_PATHS = new Set(["/login", "/forgot-password", "/reset-password", SETUP_PATH]);

// Module-scope cache: once we've observed setup is complete, there is no
// reason to ask again for the lifetime of this server process — a fresh
// install becoming "complete" is the only transition that matters, and it
// only ever happens once. A stale `false` self-corrects within one poll
// interval; that's an acceptable tradeoff against calling the Control
// Plane on every single navigation.
let setupCompleteCache: boolean | null = null;
let lastCheckedAt = 0;
const RECHECK_INTERVAL_MS = 10_000;

async function isSetupComplete(): Promise<boolean> {
  if (setupCompleteCache === true) return true;
  const now = Date.now();
  if (setupCompleteCache !== null && now - lastCheckedAt < RECHECK_INTERVAL_MS) {
    return setupCompleteCache;
  }
  try {
    const res = await fetch(`${CONTROL_PLANE_URL}/api/v1/setup/status`, { cache: "no-store" });
    if (!res.ok) return setupCompleteCache ?? false;
    const data = (await res.json()) as { complete: boolean };
    setupCompleteCache = data.complete;
    lastCheckedAt = now;
    return data.complete;
  } catch {
    // Control Plane unreachable — fail toward whatever we last knew,
    // defaulting to "not complete" (safer: shows /setup instead of
    // silently allowing an authenticated-looking page through) rather
    // than throwing and breaking every page load during a brief backend
    // restart.
    return setupCompleteCache ?? false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const complete = await isSetupComplete();

  if (!complete) {
    if (pathname !== SETUP_PATH) {
      return NextResponse.redirect(new URL(SETUP_PATH, request.url));
    }
    return NextResponse.next();
  }

  // Setup is done — /setup must never be reachable again (§9).
  if (pathname === SETUP_PATH) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (AUTH_EXEMPT_PATHS.has(pathname)) {
    // Already logged in and revisiting the login page — send them onward
    // instead of showing a login form they don't need.
    if (pathname === "/login" && hasSession) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next.js internals, static assets, the API/WS
    // proxy paths (those authenticate themselves per-request against the
    // Control Plane), and common metadata files.
    "/((?!_next/static|_next/image|api/|ws/|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)",
  ],
};
