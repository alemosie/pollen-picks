// Normalizes links so a newsletter body link and the (tracked, re-ordered) link in beehiiv's click data
// collapse to the same key.

const TRACKING_PARAMS = new Set([
  "fbclid", "gclid", "igsh", "igshid", "stkn", "xtok", "img_index", "dlrf", "mc_cid", "mc_eid", "ref", "si", "_hsenc", "_hsmi",
  // beehiiv adds its own to links in the web version of an issue (the click data lists the link without them).
  "_bhlid", "bhcl_id", "last_resource_guid", "_bhiid",
  // Other email tools' subscriber and campaign ids.
  "mkt_tok", "oly_enc_id", "oly_anon_id", "vero_id", "vero_conv", "ck_subscriber_id", "s_cid", "mibextid",
]);

export function normalizeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s || s.startsWith("mailto:") || s.startsWith("tel:")) return null;
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  u.protocol = "https:";
  u.hash = "";
  const host = u.hostname.toLowerCase().replace(/^www\./, "");

  // Instagram posts/reels: the shortcode is the identity, everything else is tracking.
  if (host === "instagram.com") {
    const m = u.pathname.match(/^\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    if (m) return `https://instagram.com/${m[1] === "reels" ? "reel" : m[1]}/${m[2]}`;
    const handle = u.pathname.split("/").filter(Boolean)[0];
    return handle ? `https://instagram.com/${handle.toLowerCase()}` : "https://instagram.com";
  }

  const kept: [string, string][] = [];
  u.searchParams.forEach((v, k) => {
    const lk = k.toLowerCase();
    if (lk.startsWith("utm_") || TRACKING_PARAMS.has(lk)) return;
    kept.push([k, v]);
  });
  kept.sort(([a], [b]) => a.localeCompare(b));
  const qs = kept.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const path = u.pathname.replace(/\/+$/, "") || "";
  return `https://${host}${path}${qs ? `?${qs}` : ""}`;
}

export function hostOf(raw: string): string | null {
  const k = normalizeUrl(raw);
  if (!k) return null;
  return new URL(k).hostname;
}

/** First path segments on instagram.com that are pages, not accounts. */
const IG_NOT_ACCOUNTS = new Set([
  "p", "reel", "reels", "tv", "stories", "explore", "accounts", "direct", "about", "developer", "legal", "web", "tags",
  "locations", "s", "share", "privacy", "challenge", "emails", "nametag", "oauth", "directory", "lite", "press", "ar",
]);

/**
 * The Instagram account a link points to, lowercase and without the "@", or null when the link is not about an account
 * (a post, a reel, a hashtag page, another site). A post link of the form instagram.com/<handle>/p/<code> counts: it is the account's.
 */
export function instagramHandle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = normalizeUrl(raw);
  if (!key) return null;
  const u = new URL(key);
  if (u.hostname !== "instagram.com") return null;
  const handle = u.pathname.split("/").filter(Boolean)[0];
  if (!handle || IG_NOT_ACCOUNTS.has(handle) || !/^[a-z0-9._]{1,30}$/.test(handle)) return null;
  return handle;
}

/**
 * An Instagram handle typed or pasted by a person ("@name", "name", or a profile link), in the form the app keeps it: lower case, no "@". Null when it
 * is not one: 1 to 30 letters, digits, periods and underscores, with no leading, trailing or doubled period.
 */
export function cleanHandle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const fromLink = instagramHandle(raw.trim());
  if (fromLink) return fromLink;
  const h = raw.trim().replace(/^@+/, "").toLowerCase();
  return /^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{1,30}$/.test(h) ? h : null;
}

/** Handles resolved from post links, keyed by `instagramPostKey` (the cached post -> account answers). */
export type KnownHandles = Record<string, string>;

/** Normalized key of a link to an Instagram post or reel (https://instagram.com/p/<code>), or null for anything else. */
export function instagramPostKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = normalizeUrl(raw);
  return key && /^https:\/\/instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+$/.test(key) ? key : null;
}

/** The post's shortcode ("DemVpYZoY-v"), or null. */
export const instagramPostCode = (raw: string | null | undefined): string | null => instagramPostKey(raw)?.split("/").pop() ?? null;

/**
 * The account to tag for a pick's link: read straight from an account link, or from `known` (the looked-up owner) for a post link.
 * Null when the link is neither, or the post has not been looked up.
 */
export function instagramTag(raw: string | null | undefined, known?: KnownHandles): string | null {
  const direct = instagramHandle(raw);
  if (direct) return direct;
  const key = instagramPostKey(raw);
  return (key && known?.[key]) || null;
}

/** The link without its query string: a second chance to match a link whose parameters differ between the body and the click data. */
export const looseKey = (key: string) => key.split("?")[0];
