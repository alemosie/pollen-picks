import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { getPostStates, type PostState } from "@/lib/bufferPost";

export type PostStatusResult = { id: string } & (PostState | { error: string });

/**
 * Where posts stand in Buffer: status, and the live URL once a post has gone out. `?ids=a,b,c` (at most 50).
 * Uses the signed-in user's own Buffer token, so it can only see posts that account can see.
 */
export async function GET(req: NextRequest) {
  const g = await requireSession(req);
  if ("response" in g) return g.response;
  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
  if (ids.length === 0) return NextResponse.json({ error: "No ids." }, { status: 400 });
  const states = await getPostStates(g.session.accessToken, ids);
  const results: PostStatusResult[] = ids.map((id) => ({ id, ...states[id] }));
  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
