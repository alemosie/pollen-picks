import { cookies } from "next/headers";
import { SESSION_COOKIE, type BufferSession, isExpired, unseal } from "./session";

/** Call after `await connection()` inside a Suspense boundary. */
export async function getSession(): Promise<BufferSession | null> {
  const s = unseal<BufferSession>((await cookies()).get(SESSION_COOKIE)?.value);
  return s && !isExpired(s) ? s : null;
}
