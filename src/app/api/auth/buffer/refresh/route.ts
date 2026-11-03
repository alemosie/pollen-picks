import { NextRequest, NextResponse } from "next/server";
import { siteUrl } from "@/lib/buffer";
import { getValidSession } from "@/lib/connections";
import { SESSION_COOKIE, readUid } from "@/lib/session";

// Pages refresh tokens on their own now (tokens live in the database). This route is for when Buffer's API
// answered 401 although the clock says the token is fine: it forces one refresh (serialized, see getValidSession).
export async function GET(req: NextRequest) {
  const want = req.nextUrl.searchParams.get("next") ?? "/source";
  // Only same-site relative paths (no open redirect).
  const back = siteUrl(want.startsWith("/") && !want.startsWith("//") ? want : "/source");
  const login = siteUrl(`/login?next=${encodeURIComponent(want)}`);
  const uid = readUid(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return NextResponse.redirect(login);
  try {
    const session = await getValidSession(uid, { force: true });
    return NextResponse.redirect(session ? back : login);
  } catch {
    return NextResponse.redirect(login);
  }
}
