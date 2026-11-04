import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Server-only: reads a public web page for the demo's "paste a link" source. Because the visitor chooses the address, this is
// the careful part: https only, no private or internal addresses (checked on every redirect), a time limit, a size limit,
// a short cache, a per-visitor rate limit and a switch to turn it off. It reads one page and keeps nothing.

export class PublicFetchError extends Error {
  constructor(
    readonly kind: "disabled" | "bad-url" | "blocked" | "not-html" | "too-big" | "failed" | "rate-limited",
    message: string,
  ) {
    super(message);
  }
}

const MAX_BYTES = 2_500_000;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 4;
const CACHE_MS = 10 * 60_000;
const UA = "PollenPicks/1.0 (+https://pollenpicks.netlify.app)";

/** Accepts what people paste ("example.beehiiv.com/p/x" too) and returns a clean https URL, or throws. */
export function cleanPublicUrl(raw: string): URL {
  let s = raw.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new PublicFetchError("bad-url", "That doesn't look like a web address.");
  }
  if (u.protocol === "http:") u.protocol = "https:";
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443"))
    throw new PublicFetchError("bad-url", "Use a normal https web address.");
  if (!u.hostname.includes(".") || isIP(u.hostname.replace(/^\[|\]$/g, "")) !== 0)
    throw new PublicFetchError("blocked", "That address can't be read.");
  u.hash = "";
  return u;
}

function privateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || (b === 0 && ip.startsWith("192.0.0.")))) ||
    (a === 198 && (b === 18 || b === 19))
  );
}
export function privateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return privateV4(ip);
  if (kind === 6) {
    const l = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(l);
    if (mapped) return privateV4(mapped[1]);
    return l === "::" || l === "::1" || /^f[cd]/.test(l) || /^fe[89ab]/.test(l);
  }
  return true;
}

async function assertPublicHost(host: string) {
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new PublicFetchError("failed", "Couldn't find that site.");
  }
  if (addrs.length === 0 || addrs.some((a) => privateAddress(a.address)))
    throw new PublicFetchError("blocked", "That address can't be read.");
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => {});
      throw new PublicFetchError("too-big", "That page is too large to read here.");
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}

type Page = { html: string; url: string };
const cache = new Map<string, { at: number; page: Page }>();

/** The page's HTML and its final address (after redirects). */
export async function fetchPublicPage(raw: string): Promise<Page> {
  if (process.env.PUBLIC_FETCH_DISABLED === "1")
    throw new PublicFetchError("disabled", "Reading other newsletters is switched off for now. Try the demo issue.");
  let url = cleanPublicUrl(raw);
  const hit = cache.get(url.href);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.page;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url.hostname);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch {
      throw new PublicFetchError("failed", "Couldn't reach that page. Check the link and try again.");
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = cleanPublicUrl(new URL(res.headers.get("location")!, url).href);
      continue;
    }
    if (!res.ok) throw new PublicFetchError("failed", `That page didn't load (error ${res.status}).`);
    if (!/text\/html|application\/xhtml/i.test(res.headers.get("content-type") ?? ""))
      throw new PublicFetchError("not-html", "That link isn't a web page.");
    const page = { html: await readCapped(res), url: url.href };
    if (cache.size >= 50) cache.delete(cache.keys().next().value!);
    cache.set(url.href, { at: Date.now(), page });
    return page;
  }
  throw new PublicFetchError("failed", "That link redirects too many times.");
}

// A small per-visitor limit. In memory, so each server instance counts for itself: it stops loops and casual abuse, not a determined attacker.
const hits = new Map<string, number[]>();
export function allowFetch(visitor: string, max = 20, windowMs = 10 * 60_000): boolean {
  const now = Date.now();
  const recent = (hits.get(visitor) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(visitor, recent);
    return false;
  }
  recent.push(now);
  hits.set(visitor, recent);
  if (hits.size > 2000) hits.delete(hits.keys().next().value!);
  return true;
}
