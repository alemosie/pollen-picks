import { NextRequest, NextResponse } from "next/server";
import { authorizeUrl, siteUrl } from "@/lib/buffer";
import { pkcePair, randomState } from "@/lib/pkce";
import { PKCE_COOKIE, cookieOpts, seal } from "@/lib/session";

// ?next=/path sends the visitor back there after Buffer login (e.g. a shared link), not to the default first step.
// Everyone sees the /login intro first (what Buffer asks, what is kept); its button comes back here with continue=1.
// Gating here means any link to this route (demo, landing, shared links) passes through the intro.
export async function GET(req: NextRequest) {
  const want = req.nextUrl.searchParams.get("next") ?? "";
  const next = want.startsWith("/") && !want.startsWith("//") ? want : undefined;
  if (req.nextUrl.searchParams.get("continue") !== "1") {
    return NextResponse.redirect(siteUrl(next ? `/login?next=${encodeURIComponent(next)}` : "/login"));
  }
  const { verifier, challenge } = pkcePair();
  const state = randomState();
  const res = NextResponse.redirect(authorizeUrl(state, challenge));
  res.cookies.set(PKCE_COOKIE, seal({ verifier, state, next }), { ...cookieOpts, maxAge: 600 });
  return res;
}
