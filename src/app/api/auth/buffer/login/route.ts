import { NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/buffer";
import { pkcePair, randomState } from "@/lib/pkce";
import { PKCE_COOKIE, cookieOpts, seal } from "@/lib/session";

export async function GET() {
  const { verifier, challenge } = pkcePair();
  const state = randomState();
  const res = NextResponse.redirect(authorizeUrl(state, challenge));
  res.cookies.set(PKCE_COOKIE, seal({ verifier, state }), { ...cookieOpts, maxAge: 600 });
  return res;
}
