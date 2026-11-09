import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSameSite } from "@/lib/sameSite";
import { cleanShareLinks } from "@/lib/sharedSlides";
import { UUID } from "@/lib/uuid";

// Stores one piece of feedback with the visit it came from: the random per-tab session id, the steps that session reached
// (read from the usage events here, never trusted from the browser) and, when logged in, the account.
const HOSTS = ["beehiiv", "substack", "other"] as const;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) || null : null);
const rating = (v: unknown) => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5 ? (v as number) : null);

export async function POST(req: NextRequest) {
  // Same-site requests only, so the table isn't an open target for other sites.
  if (!isSameSite(req)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const host = HOSTS.find((h) => h === b.host);
  const likelihood = rating(b.likelihood);
  if (!host || likelihood === null || typeof b.quoteOk !== "boolean")
    return NextResponse.json({ error: "Please answer the required questions." }, { status: 400 });
  const hostOther = host === "other" ? text(b.hostOther, 60) : null;

  const sessionId = typeof b.session === "string" && UUID.test(b.session) ? b.session : null;
  const userId = await sessionUserId();

  let steps: string[] = [];
  // The flow the visit was in (demo or app) is the one its latest event came from; without events, whether they are logged in.
  let flow: "demo" | "app" = userId ? "app" : "demo";
  if (sessionId) {
    const { data } = await db().from("demo_events").select("event, flow").eq("session_id", sessionId).order("created_at").limit(100);
    const rows = (data ?? []) as { event: string; flow: "demo" | "app" }[];
    steps = [...new Set(rows.map((r) => r.event))];
    if (rows.length > 0) flow = rows[rows.length - 1].flow;
  }

  // "OK to share?" (yes): also keep the links to the source and the slides (checked first, see sharedSlides). Nothing is kept for a no.
  const siteHosts = [req.headers.get("x-forwarded-host"), req.headers.get("host"), req.nextUrl.host].flatMap((h) => (h ? h.split(",").map((x) => x.trim()) : []));
  const shared = b.quoteOk && b.share ? cleanShareLinks(b.share, siteHosts) : null;

  const { error } = await db().from("feedback").insert({
    flow,
    user_id: userId,
    session_id: sessionId,
    steps,
    host,
    host_other: hostOther,
    easy: rating(b.easy),
    likelihood,
    loved: text(b.loved, 1000),
    would_change: text(b.wouldChange, 1000),
    quote_ok: b.quoteOk,
    // Left out unless shared, so feedback still saves before these columns (db/supabase/0024) exist.
    ...(shared ?? {}),
  });
  if (error) {
    console.error("feedback failed:", error.message);
    return NextResponse.json({ error: "Couldn't save that. Please try again in a moment." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
