import { NextRequest, NextResponse } from "next/server";
import { refresh, siteUrl } from "@/lib/buffer";
import { BufferSession, SESSION_COOKIE, cookieOpts, seal, unseal } from "@/lib/session";

// Refresh tokens are single-use, so this runs in a route handler where the new
// token set can be written back to the cookie in the same response.
export async function GET(req: NextRequest) {
  const session = unseal<BufferSession>(req.cookies.get(SESSION_COOKIE)?.value);
  const want = req.nextUrl.searchParams.get("next") ?? "/source";
  // Only same-site relative paths (no open redirect).
  const back = siteUrl(want.startsWith("/") && !want.startsWith("//") ? want : "/source");
  const login = siteUrl(`/api/auth/buffer/login?next=${encodeURIComponent(want)}`);
  if (!session?.refreshToken) return NextResponse.redirect(login);
  try {
    const next = await refresh(session.refreshToken);
    const res = NextResponse.redirect(back);
    res.cookies.set(SESSION_COOKIE, seal(next), { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
    return res;
  } catch {
    const res = NextResponse.redirect(login);
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
}
