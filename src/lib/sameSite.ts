import type { NextRequest } from "next/server";

/**
 * True when a browser request comes from this site's own pages. Browsers send `Sec-Fetch-Site` and page scripts can't change
 * it, so it is the primary check. Without it (older browsers, tools) the Origin's host must match one of the hosts the request
 * arrived on: behind a proxy or tunnel the host the app sees is not always the public one, so the forwarded host counts too.
 */
export function isSameSite(req: NextRequest): boolean {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin" || fetchSite === "none";
  const origin = req.headers.get("origin");
  if (!origin) return true; // not a cross-site browser request
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  const hosts = [req.headers.get("x-forwarded-host"), req.headers.get("host"), req.nextUrl.host]
    .flatMap((h) => (h ? h.split(",").map((x) => x.trim()) : []))
    .filter(Boolean);
  return hosts.includes(host);
}
