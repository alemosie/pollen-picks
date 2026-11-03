import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Buffer fetches the slide images itself, with no cookies and no login, so the image URLs it gets carry a signature instead:
// an HMAC over the whole query (which issue, which picks, the template, who it is for and when it expires). Only this
// server can make one, nothing in it can be changed without invalidating it, and it opens exactly that one set of slides.

/** Long enough for Buffer to fetch the images when it creates a post, or when a scheduled one goes out. */
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return createHash("sha256").update(`slide-preview:${secret}`).digest();
}

/** Everything except the slide number (one signature covers every slide of the set) and the signature itself. */
const canonical = (p: URLSearchParams) =>
  [...p.entries()]
    .filter(([k]) => k !== "n" && k !== "sig")
    .sort(([a, x], [b, y]) => (a === b ? x.localeCompare(y) : a.localeCompare(b)))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

const mac = (p: URLSearchParams) => createHmac("sha256", key()).update(canonical(p)).digest("base64url");

/** The same query with `u` (the user), `exp` and `sig` added. Add `n` (the slide) afterwards. */
export function signPreview(params: URLSearchParams, uid: string, now = Date.now()): URLSearchParams {
  const p = new URLSearchParams(params);
  p.set("u", uid);
  p.set("exp", String(now + TTL_MS));
  p.set("sig", mac(p));
  return p;
}

/** The user id a valid, unexpired signature was made for, else null. */
export function verifyPreview(params: URLSearchParams, now = Date.now()): string | null {
  const sig = params.get("sig");
  const uid = params.get("u");
  const exp = Number(params.get("exp"));
  if (!sig || !uid || !Number.isFinite(exp) || exp < now) return null;
  const want = Buffer.from(mac(params));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? uid : null;
}
