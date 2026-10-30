import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Spike-only session: tokens live in an encrypted, httpOnly cookie.
// Later this moves to Supabase (connections table, encrypted at rest).
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
export const SESSION_COOKIE = "b2b_session";
export const PKCE_COOKIE = "b2b_pkce";

export const isExpired = (s: BufferSession) => s.expiresAt < Date.now();
