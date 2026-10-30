import { NextRequest, NextResponse } from "next/server";
import { BufferSession, SESSION_COOKIE, unseal } from "./session";

// Returns the session, or a 401/refresh response when the access token is missing or expired.
export async function requireSession(req: NextRequest): Promise<{ session: BufferSession } | { response: NextResponse }> {
  const session = unseal<BufferSession>(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return { response: NextResponse.json({ error: "Not connected to Buffer" }, { status: 401 }) };
  if (session.expiresAt < Date.now()) return { response: NextResponse.json({ error: "Token expired, reload /spike to refresh" }, { status: 401 }) };
  return { session };
}
