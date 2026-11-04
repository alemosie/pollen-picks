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
  const uid = await uidFromCookie();
  const s = uid ? await getValidSession(uid) : null;
  if (uid && s) return { ...s, userId: uid };
  // Not logged in, or Buffer access was revoked: show the login intro, which continues to Buffer and comes back to `next` (a shared link keeps working).
  redirect(`/login?next=${encodeURIComponent(next)}`);
}

/** True when the visitor has a session cookie. Cheap on purpose (no database call): it only picks the landing-page button. */
export async function hasSession(): Promise<boolean> {
  return (await uidFromCookie()) !== null;
}
