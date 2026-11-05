import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { parseFilters } from "@/lib/historyFilters";
import { refreshHistory } from "@/lib/postHistory";
import { processQueue } from "@/lib/sendQueue";
import { UUID } from "@/lib/uuid";

/**
 * What a page that is watching sends asks for. It (1) moves this user's queue along a little, so an open tab makes a send quick, (2) asks Buffer
 * where recent publish-now posts stand, and (3) returns the entries: only one send's with `?batch=<id>`, otherwise the latest hundred (narrowed by the History page's `service`, `channel`, `status` and `mode` filters).
 */
export async function POST(req: NextRequest) {
  const g = await requireSession(req);
  if ("response" in g) return g.response;
  const batch = req.nextUrl.searchParams.get("batch");
  if (batch && !UUID.test(batch)) return NextResponse.json({ error: "Bad batch." }, { status: 400 });
  try {
    await processQueue({ userId: g.session.userId, limit: 4, deadlineMs: 6_000 });
    const history = await refreshHistory(g.session.userId, g.session.accessToken, { batchId: batch ?? undefined, filters: parseFilters((k) => req.nextUrl.searchParams.get(k)) });
    return NextResponse.json({ history }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("refreshing history failed:", (e as Error).message);
    return NextResponse.json({ error: "Couldn't check on your posts right now. Try again in a moment." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
