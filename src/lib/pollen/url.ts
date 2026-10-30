// Normalizes links so a newsletter body link and the (tracked, re-ordered) link in Beehiiv's click data
// collapse to the same key.

const TRACKING_PARAMS = new Set(["fbclid", "gclid", "igsh", "igshid", "stkn", "xtok", "img_index", "dlrf", "mc_cid", "mc_eid", "ref", "si", "_hsenc", "_hsmi"]);

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
