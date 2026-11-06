import { NextRequest, NextResponse } from "next/server";
import { deleteAccount } from "@/lib/accountDelete";
import { requireSession } from "@/lib/guard";
import { HINT_COOKIE, LEGACY_SESSION_COOKIE, SESSION_COOKIE } from "@/lib/session";

// Deletes the signed-in user's data and ends their session. Only ever their own: the id comes from the session, never from the request.
// The body must say `{ "confirm": true }`, so a stray request can't do it.

const noStore = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  const body = (await req.json().catch(() => null)) as { confirm?: unknown } | null;
  if (body?.confirm !== true) return NextResponse.json({ error: "Please confirm that you want to delete your data." }, { status: 400, headers: noStore });
  try {
    await deleteAccount(auth.session.userId);
  } catch (e) {
    console.error("account delete failed:", (e as Error).message);
    return NextResponse.json({ error: "Couldn't delete everything. Nothing is lost by trying again in a moment." }, { status: 503, headers: noStore });
  }
  const res = NextResponse.json({ deleted: true }, { headers: noStore });
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(HINT_COOKIE);
  res.cookies.delete(LEGACY_SESSION_COOKIE);
  return res;
}
