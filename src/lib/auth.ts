import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, type BufferSession, isExpired, unseal } from "./session";

const read = async () => unseal<BufferSession>((await cookies()).get(SESSION_COOKIE)?.value);

/**
 * Call after `await connection()` inside a Suspense boundary.
 * Returns the session; if the access token has expired but a refresh token exists, silently refreshes via the
 * route handler (the only place the cookie can be rewritten) and comes back to `next`. Otherwise sends the user home.
 */
export async function requireSession(next: string): Promise<BufferSession> {
  const s = await read();
  if (s && !isExpired(s)) return s;
  if (s?.refreshToken) redirect(`/api/auth/buffer/refresh?next=${encodeURIComponent(next)}`);
  redirect("/");
}

/** True when the visitor can get back in without logging in again (valid token, or a refresh token). */
export async function hasSession(): Promise<boolean> {
  const s = await read();
  return !!s && (!isExpired(s) || !!s.refreshToken);
}
