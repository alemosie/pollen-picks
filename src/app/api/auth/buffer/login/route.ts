import { NextRequest, NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/buffer";
import { pkcePair, randomState } from "@/lib/pkce";
import { PKCE_COOKIE, cookieOpts, seal } from "@/lib/session";

// ?next=/path sends the visitor back there after Buffer login (e.g. a shared link), not to the default first step.
export async function GET(req: NextRequest) {
  const want = req.nextUrl.searchParams.get("next") ?? "";
  const next = want.startsWith("/") && !want.startsWith("//") ? want : undefined;
  const { verifier, challenge } = pkcePair();
  const state = randomState();
  const res = NextResponse.redirect(authorizeUrl(state, challenge));
  res.cookies.set(PKCE_COOKIE, seal({ verifier, state, next }), { ...cookieOpts, maxAge: 600 });
  return res;
}
