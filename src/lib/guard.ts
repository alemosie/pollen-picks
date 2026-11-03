import { NextRequest, NextResponse } from "next/server";
import { getValidSession } from "./connections";
import { SESSION_COOKIE, readUid } from "./session";
import type { AuthedSession } from "./auth";

// Returns the session (access token refreshed if it had expired), or a 401/503 response.
export async function requireSession(req: NextRequest): Promise<{ session: AuthedSession } | { response: NextResponse }> {
  const uid = readUid(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return { response: NextResponse.json({ error: "Not connected to Buffer" }, { status: 401 }) };
  try {
    const session = await getValidSession(uid);
    if (!session) return { response: NextResponse.json({ error: "Buffer connection expired, log in again" }, { status: 401 }) };
    return { session: { ...session, userId: uid } };
  } catch (e) {
    return { response: NextResponse.json({ error: (e as Error).message }, { status: 503 }) };
  }
}
