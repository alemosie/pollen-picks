import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { UUID } from "@/lib/uuid";

// Stores one piece of feedback with the visit it came from: the random per-tab session id, the steps that session reached
// (read from the usage events here, never trusted from the browser) and, when logged in, the account.
const HOSTS = ["beehiiv", "substack", "other"] as const;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) || null : null);
const rating = (v: unknown) => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5 ? (v as number) : null);

export async function POST(req: NextRequest) {
  // Same-site requests only, so the table isn't an open target for other sites.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.nextUrl.host) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const host = HOSTS.find((h) => h === b.host);
  const likelihood = rating(b.likelihood);
  if (!host || likelihood === null || typeof b.quoteOk !== "boolean")
    return NextResponse.json({ error: "Please answer the required questions." }, { status: 400 });
  const hostOther = host === "other" ? text(b.hostOther, 60) : null;

  const sessionId = typeof b.session === "string" && UUID.test(b.session) ? b.session : null;
  const userId = await sessionUserId();

  let steps: string[] = [];
  if (sessionId) {
    const { data } = await db().from("demo_events").select("event").eq("session_id", sessionId).order("created_at").limit(100);
    steps = [...new Set((data ?? []).map((r: { event: string }) => r.event))];
  }

  const { error } = await db().from("feedback").insert({
    flow: userId ? "app" : "demo",
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
  });
  if (error) {
    console.error("feedback failed:", error.message);
    return NextResponse.json({ error: "Couldn't save that. Please try again in a moment." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
