import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, gql, siteUrl } from "@/lib/buffer";
import { saveBufferSession, upsertUser } from "@/lib/connections";
import { HINT_COOKIE, LEGACY_SESSION_COOKIE, PKCE_COOKIE, SESSION_COOKIE, cookieOpts, hintCookieOpts, seal, unseal } from "@/lib/session";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  if (error) return NextResponse.json({ error, description: url.searchParams.get("error_description") }, { status: 400 });

  const pkce = unseal<{ verifier: string; state: string; next?: string }>(req.cookies.get(PKCE_COOKIE)?.value);
  const code = url.searchParams.get("code");
  if (!pkce || !code || url.searchParams.get("state") !== pkce.state) {
    return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
  }

  try {
    const tokens = await exchangeCode(code, pkce.verifier);

    // Buffer account id = identity. First login creates the user; later logins find them again.
    const acct = await gql<{ account: { id: string; email?: string | null } }>(tokens.accessToken, "{ account { id email } }");
    const account = acct.data?.account;
    if (!account?.id) throw new Error(acct.errors?.[0]?.message ?? `Could not read the Buffer account (${acct.status})`);

    const userId = await upsertUser(account.id, account.email);
    await saveBufferSession(userId, tokens);

    const res = NextResponse.redirect(siteUrl(pkce.next && pkce.next.startsWith("/") && !pkce.next.startsWith("//") ? pkce.next : "/source"));
    res.cookies.set(SESSION_COOKIE, seal({ uid: userId }), { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
    res.cookies.set(HINT_COOKIE, "1", { ...hintCookieOpts, maxAge: 60 * 60 * 24 * 30 });
    res.cookies.delete(LEGACY_SESSION_COOKIE);
    res.cookies.delete(PKCE_COOKIE);
    return res;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
