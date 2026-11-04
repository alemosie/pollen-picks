import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionUserId } from "@/lib/auth";
import { DEMO_EVENTS } from "@/lib/events";
import { UUID } from "@/lib/uuid";

// Counts one step of the flow. Nothing from the request is stored except the event name, which content was used, the
// random per-tab session id, and whether the visitor is logged in (the cookie is read, never stored). Best effort: it always answers quickly, and a failed write is only logged.
export async function POST(req: NextRequest) {
  // Same-site requests only, so the table isn't an open target for other sites.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.nextUrl.host) return NextResponse.json({ ok: false }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { event?: unknown; source?: unknown; session?: unknown };
  const event = DEMO_EVENTS.find((e) => e === body.event);
  if (!event) return NextResponse.json({ ok: false }, { status: 400 });
  const { error } = await db()
    .from("demo_events")
    .insert({
      event,
      source: typeof body.source === "string" && /^[a-z]{1,20}$/.test(body.source) ? body.source : "sample",
      session_id: typeof body.session === "string" && UUID.test(body.session) ? body.session : null,
      flow: (await sessionUserId()) ? "app" : "demo",
    });
  if (error) console.error("demo event failed:", error.message);
  return NextResponse.json({ ok: true });
}
