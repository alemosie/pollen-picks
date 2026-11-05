import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getValidSession } from "./connections";
import { SESSION_COOKIE, readUid, type BufferSession } from "./session";

export type AuthedSession = BufferSession & { userId: string };

/** The signed-in user's id from the session cookie, or null. No database call. */
export const sessionUserId = async () => uidFromCookie();

const uidFromCookie = async () => readUid((await cookies()).get(SESSION_COOKIE)?.value);

/**
 * Call after `await connection()` inside a Suspense boundary.
 * The cookie only carries the user id; tokens live in the database and are refreshed here when they have expired
 * (no cookie rewrite is needed anymore, so this works in any server component).
 */
export async function requireSession(next: string): Promise<AuthedSession> {
  const s = await currentSession();
  if (s) return s;
  return toLogin(next);
}

/** The signed-in user's usable session, or null (no redirect). For pages that load other things at the same time and only then decide. */
export async function currentSession(): Promise<AuthedSession | null> {
  const uid = await uidFromCookie();
  const s = uid ? await getValidSession(uid) : null;
  return uid && s ? { ...s, userId: uid } : null;
}

/** Not logged in, or Buffer access was revoked: show the login intro, which continues to Buffer and comes back to `next` (a shared link keeps working). */
export function toLogin(next: string): never {
  redirect(`/login?next=${encodeURIComponent(next)}`);
}

/** True when the visitor has a session cookie. Cheap on purpose (no database call). Use `hasLiveSession` to decide where a button leads. */
export async function hasSession(): Promise<boolean> {
  return (await uidFromCookie()) !== null;
}

/**
 * True only when the cookie's user still has a usable Buffer session (same check as `requireSession`, without the redirect).
 * A cookie alone can outlive its session (revoked grant, other database), and sending that visitor to a protected page loops back to /login.
 */
export async function hasLiveSession(): Promise<boolean> {
  const uid = await uidFromCookie();
  if (!uid) return false;
  try {
    return (await getValidSession(uid)) !== null;
  } catch {
    return false;
  }
}
