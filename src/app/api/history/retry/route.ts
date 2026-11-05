import { after, NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { requeueFailed } from "@/lib/postHistory";
import { processQueue } from "@/lib/sendQueue";

/**
 * "Retry" on failed History entries: `{ ids: number[] }` (up to 50) puts this account's failed entries back in the queue and starts working on
 * them. Only entries that failed (so Buffer created nothing) and still have their caption go back; "unknown" ones never do, because they may
 * already have gone out.
 */
export async function POST(req: NextRequest) {
  const g = await requireSession(req);
  if ("response" in g) return g.response;
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((n): n is number => Number.isInteger(n) && n > 0).slice(0, 50) : [];
  if (ids.length === 0) return NextResponse.json({ error: "Nothing to retry." }, { status: 400 });
  try {
    const requeued = await requeueFailed(g.session.userId, ids);
    if (requeued > 0) after(() => processQueue({ userId: g.session.userId, limit: 6, deadlineMs: 8_000 }));
    return NextResponse.json({ requeued }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("retrying failed posts failed:", (e as Error).message);
    return NextResponse.json({ error: "Couldn't retry right now. Try again in a moment." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
