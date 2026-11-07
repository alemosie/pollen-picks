import { NextRequest, NextResponse } from "next/server";
import { prepareCreation } from "@/lib/creationRequest";
import { requireSession } from "@/lib/guard";
import { isSameSite } from "@/lib/sameSite";
import { SAVED_STEPS } from "@/lib/savedCreationShape";
import { saveCreation } from "@/lib/savedCreations";

const noStore = { "Cache-Control": "no-store" };

/**
 * "Save": keeps the picks, the slide design and what Write kept (caption order and hand edits) for one issue, for this account. Saving the same
 * issue again replaces the earlier one. The issue's title, newsletter and address come from the server, not from the request, and only picks that
 * exist in that issue are kept. No images are stored: slides are drawn again from the picks and the design when it is opened.
 * The answer carries the saved creation's id and the time the server gave it, which the page needs to keep it up to date as the person works.
 */
export async function POST(req: NextRequest) {
  if (!isSameSite(req)) return NextResponse.json({ error: "Not allowed." }, { status: 403, headers: noStore });
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const prepared = await prepareCreation(body, SAVED_STEPS);
  if ("error" in prepared) return NextResponse.json({ error: prepared.error }, { status: prepared.status, headers: noStore });
  try {
    const saved = await saveCreation(auth.session.userId, prepared.input);
    return NextResponse.json({ ok: true, ...saved }, { headers: noStore });
  } catch (e) {
    console.error("saving a creation failed:", (e as Error).message);
    return NextResponse.json({ error: "Couldn't save right now. Try again in a moment." }, { status: 503, headers: noStore });
  }
}
