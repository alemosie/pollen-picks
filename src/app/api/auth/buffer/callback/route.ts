import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/buffer";
import { PKCE_COOKIE, SESSION_COOKIE, cookieOpts, seal, unseal } from "@/lib/session";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  if (error) return NextResponse.json({ error, description: url.searchParams.get("error_description") }, { status: 400 });

  const pkce = unseal<{ verifier: string; state: string }>(req.cookies.get(PKCE_COOKIE)?.value);
  const code = url.searchParams.get("code");
  if (!pkce || !code || url.searchParams.get("state") !== pkce.state) {
    return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
  }

  try {
    const session = await exchangeCode(code, pkce.verifier);
    const res = NextResponse.redirect(new URL("/source", req.url));
    res.cookies.set(SESSION_COOKIE, seal(session), { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
    res.cookies.delete(PKCE_COOKIE);
    return res;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
