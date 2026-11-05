import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { resolvePostHandle } from "@/lib/instagramHandles";

// Pick step: "which account owns this Instagram post?" Body: { url }. Answers { handle } or { error }.
// Cached answers are free for every signed-in user. A new lookup spends the app's Apify token: unlimited for APIFY_ALLOWED_EMAILS,
// APIFY_FREE_LOOKUPS for everyone else, and nobody past APIFY_MONTHLY_CAP. The public demo never calls this: it only shows cached answers.

const noStore = { "Cache-Control": "no-store" };
const STATUS = { invalid: 400, "limit-reached": 429, capped: 503, "own-token": 402, "not-found": 404, unavailable: 503, failed: 502 } as const;

export async function POST(req: NextRequest) {
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" && body.url.length <= 1000 ? body.url : "";
  const r = await resolvePostHandle(auth.session.userId, url);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: STATUS[r.error], headers: noStore });
  return NextResponse.json({ handle: r.handle }, { headers: noStore });
}
