import { NextResponse, type NextRequest } from "next/server";

const MODRINTH_API = "https://api.modrinth.com/v2";

// Modrinth asks integrations to identify themselves with a descriptive
// User-Agent (docs.modrinth.com) — browsers won't let client code set this
// header, so the request is proxied through this route instead of calling
// the API directly from the marketplace view.
const USER_AGENT = "CometaMcCore/0.1 (+https://github.com/cometa-mccore; demo frontend, no auth)";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = params.get("query") ?? "";
  const projectType = params.get("projectType");
  const index = params.get("index") === "downloads" ? "downloads" : "relevance";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 20, 1), 50);
  const offset = Math.max(Number(params.get("offset")) || 0, 0);

  const upstream = new URL(`${MODRINTH_API}/search`);
  upstream.searchParams.set("query", query);
  upstream.searchParams.set("index", index);
  upstream.searchParams.set("limit", String(limit));
  upstream.searchParams.set("offset", String(offset));
  if (projectType === "plugin" || projectType === "mod") {
    upstream.searchParams.set("facets", JSON.stringify([[`project_type:${projectType}`]]));
  }

  try {
    const res = await fetch(upstream, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Modrinth API responded with ${res.status}` }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Could not reach Modrinth" }, { status: 502 });
  }
}
