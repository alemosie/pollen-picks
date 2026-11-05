import { after, NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { requeueFailed } from "@/lib/postHistory";
import { processQueue } from "@/lib/sendQueue";

/**
 * "Retry" on failed History entries: `{ ids: number[] }` (up to 50) puts this account's failed entries back in the queue and starts working on
 * them. Only entries that failed (so Buffer created nothing) and still have their caption go back; "unknown" ones never do, because they may
 * already have gone out. A failed "publish now" entry goes live when retried, so it only goes back with `confirmed: true` (as sending live does);
 * without it the answer is 409 and nothing changes. `sendAgain: true` also takes "unknown" entries (the request died, so they may already be in
 * Buffer): those always need `confirmed`.
 */
export async function POST(req: NextRequest) {
  const g = await requireSession(req);
  if ("response" in g) return g.response;
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown; confirmed?: unknown; sendAgain?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((n): n is number => Number.isInteger(n) && n > 0).slice(0, 50) : [];
  if (ids.length === 0) return NextResponse.json({ error: "Nothing to retry." }, { status: 400 });
  try {
    const { requeued, needsConfirm } = await requeueFailed(g.session.userId, ids, body.confirmed === true, body.sendAgain === true);
    if (needsConfirm > 0)
      return NextResponse.json({ error: "This needs a yes first.", needsConfirm }, { status: 409, headers: { "Cache-Control": "no-store" } });
    if (requeued > 0) after(() => processQueue({ userId: g.session.userId, limit: 6, deadlineMs: 8_000 }));
    return NextResponse.json({ requeued }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("retrying failed posts failed:", (e as Error).message);
    return NextResponse.json({ error: "Couldn't retry right now. Try again in a moment." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
