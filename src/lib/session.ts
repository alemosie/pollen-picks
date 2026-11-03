import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// The session cookie is an encrypted (AES-256-GCM), httpOnly cookie holding only the user id.
// Buffer tokens live in the database (see connections.ts); the same sealing is used for the short-lived PKCE cookie.
function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return createHash("sha256").update(secret).digest();
}

export function seal(data: unknown): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(data), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64url");
}

export function unseal<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    const buf = Buffer.from(value, "base64url");
    const d = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    const dec = Buffer.concat([d.update(buf.subarray(28)), d.final()]);
    return JSON.parse(dec.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export type BufferSession = { accessToken: string; refreshToken?: string; expiresAt: number };
export type AppSession = { uid: string };
export const SESSION_COOKIE = "pp_session";
/** The old spike cookie that held the Buffer tokens themselves. Cleared on login and logout. */
export const LEGACY_SESSION_COOKIE = "b2b_session";
export const PKCE_COOKIE = "b2b_pkce";

export const isExpired = (s: BufferSession) => s.expiresAt < Date.now();

/** The user id from a session cookie value, or null if it is missing or not valid. */
export const readUid = (value: string | undefined): string | null => {
  const uid = unseal<AppSession>(value)?.uid;
  return typeof uid === "string" && uid ? uid : null;
};
