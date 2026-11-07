import { NextRequest, NextResponse } from "next/server";
import { saveRunAsCreation } from "@/lib/currentRun";
import { requireSession } from "@/lib/guard";
import { isSameSite } from "@/lib/sameSite";

const noStore = { "Cache-Control": "no-store" };

/** "Save it first": the current run becomes the saved creation for its issue (replacing the earlier one for that issue). The caller discards the run after. */
export async function POST(req: NextRequest) {
  if (!isSameSite(req)) return NextResponse.json({ error: "Not allowed." }, { status: 403, headers: noStore });
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  try {
    const saved = await saveRunAsCreation(auth.session.userId);
    if (!saved) return NextResponse.json({ error: "There is no run to save." }, { status: 404, headers: noStore });
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    console.error("saving the current run failed:", (e as Error).message);
    return NextResponse.json({ error: "Couldn't save it right now. Try again in a moment." }, { status: 503, headers: noStore });
  }
}
