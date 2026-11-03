// Server-only: talks to the beehiiv API (v2) with the creator's own API key.
// The key is checked once when it is saved. Pollen Picks only ever READS from beehiiv: it never edits, sends or deletes.

import { isPublicationId } from "./flow";
import type { ClickRow } from "./pollen/types";

const API = "https://api.beehiiv.com/v2";

/** What we keep about a publication after connecting. `logo` is only there if beehiiv returns one; the UI shows an initial otherwise. */
export type BeehiivPublication = {
  id: string;
  name: string;
  organization?: string;
  /** https URL of the publication's logo. */
  logo?: string;
  /** Unix seconds. */
  created?: number;
  subscribers?: number;
  /** Percent, e.g. 52.4. */
  openRate?: number;
  clickRate?: number;
};

export type BeehiivKeyErrorKind = "invalid" | "no-publications" | "rate-limited" | "unreachable" | "not-found" | "no-content";

export class BeehiivKeyError extends Error {
  constructor(
    readonly kind: BeehiivKeyErrorKind,
    message: string,
  ) {
    super(message);
  }
}

/** Trims pasted whitespace, quotes and a leading "Bearer ". */
export function cleanKey(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

/** Cheap shape check before calling beehiiv: no spaces, a sane length, URL-safe characters. */
export const looksLikeKey = (key: string) => /^[A-Za-z0-9._~-]{16,256}$/.test(key);

type Raw = {
  id?: unknown;
  name?: unknown;
  organization_name?: unknown;
  logo?: unknown;
  logo_url?: unknown;
  created?: unknown;
  stats?: { active_subscriptions?: unknown; average_open_rate?: unknown; average_click_rate?: unknown } | null;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
/** beehiiv reports rates either as a fraction or as a percentage. Normalize to a percentage. */
const pct = (v: unknown) => {
  const n = num(v);
  return n === undefined ? undefined : Math.round((n <= 1 ? n * 100 : n) * 10) / 10;
};

const httpsUrl = (v: unknown) => (typeof v === "string" && /^https:\/\//i.test(v) ? v : undefined);

function toPublication(p: Raw): BeehiivPublication | null {
  if (typeof p.id !== "string" || typeof p.name !== "string" || !p.id || !p.name) return null;
  return {
    id: p.id,
    name: p.name,
    organization: typeof p.organization_name === "string" && p.organization_name !== p.name ? p.organization_name : undefined,
    logo: httpsUrl(p.logo) ?? httpsUrl(p.logo_url),
    created: num(p.created),
    subscribers: num(p.stats?.active_subscriptions),
    openRate: pct(p.stats?.average_open_rate),
    clickRate: pct(p.stats?.average_click_rate),
  };
}

async function listPublications(key: string, withStats: boolean): Promise<Response> {
  const q = new URLSearchParams({ limit: "100" });
  if (withStats) q.append("expand[]", "stats");
  return fetch(`${API}/publications?${q}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
}

/**
 * Checks the key against beehiiv and returns the publications it can see (a key limited to one publication sees one).
 * Throws BeehiivKeyError with a message that is safe to show to the user. The key is never included in errors or logs.
 */
export async function checkKey(key: string): Promise<BeehiivPublication[]> {
  let res: Response;
  try {
    res = await listPublications(key, true);
    // Stats are a nice-to-have. If beehiiv rejects the expand option, ask again without it.
    if (res.status === 400) res = await listPublications(key, false);
  } catch {
    throw new BeehiivKeyError("unreachable", "Couldn't reach beehiiv. Try again in a moment.");
  }
  if (res.status === 401 || res.status === 403) {
    throw new BeehiivKeyError("invalid", "beehiiv didn't accept this key. Check that you copied all of it, and that it hasn't been deleted.");
  }
  if (res.status === 429) throw new BeehiivKeyError("rate-limited", "beehiiv says too many requests. Wait a minute and try again.");
  if (!res.ok) throw new BeehiivKeyError("unreachable", "beehiiv had a problem checking this key. Try again in a moment.");

  const body = (await res.json().catch(() => null)) as { data?: Raw[] } | null;
  const publications = (body?.data ?? []).map(toPublication).filter((p): p is BeehiivPublication => p !== null);
  if (publications.length === 0) {
    throw new BeehiivKeyError("no-publications", "This key works, but it can't see any publications. Check which publication it is limited to.");
  }
  // The list may leave the logo out. The single-publication endpoint might have it; ask, but never fail the connect over it.
  await Promise.all(
    publications.slice(0, 10).map(async (p) => {
      if (!p.logo) p.logo = await fetchLogo(key, p.id);
    }),
  );
  return publications;
}

async function fetchLogo(key: string, publicationId: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${API}/publications/${publicationId}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return undefined;
    const d = ((await res.json().catch(() => null)) as { data?: Raw } | null)?.data;
    return httpsUrl(d?.logo) ?? httpsUrl(d?.logo_url);
  } catch {
    return undefined;
  }
}

/** A logo URL a user typed: https only, a sane length. Returns the cleaned URL, or undefined if it isn't usable. */
export function cleanLogoUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const v = raw.trim();
  if (v.length > 500 || !/^https:\/\/[^\s]+$/i.test(v)) return undefined;
  try {
    new URL(v);
    return v;
  } catch {
    return undefined;
  }
}

// ---- Issues (posts) ----

/** One sent issue, for the list on the source step. */
export type BeehiivIssue = { id: string; title: string; subtitle?: string; publishedAt: string; url?: string; /** https image URL for the issue: beehiiv's thumbnail_url, else the first picture in its body. */ thumbnail?: string };

/** An issue with everything the Pick step needs: its HTML body and per-link click counts. */
export type BeehiivIssueContent = { id: string; title: string; publishedAt: string; url?: string; html: string; clicks: ClickRow[] };

type RawPost = {
  id?: unknown;
  title?: unknown;
  subtitle?: unknown;
  publish_date?: unknown;
  displayed_date?: unknown;
  web_url?: unknown;
  thumbnail_url?: unknown;
  content?: { free?: { web?: unknown } } | null;
  stats?: { clicks?: unknown } | null;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
/** Only https image addresses are passed on to the browser. */
/**
 * The first real picture in an issue's web HTML, used only when an issue has no thumbnail_url.
 * Skips tracking pixels and tiny images.
 */
export function firstImage(html: unknown): string | undefined {
  if (typeof html !== "string") return undefined;
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.replace(/&amp;/g, "&");
    if (!src || !/^https:\/\//i.test(src)) continue;
    if (/\/(open|pixel|track|beacon)\b|emoji|spacer/i.test(src)) continue;
    const dim = /\b(?:width|height)\s*=\s*["']?(\d+)/gi;
    let tiny = false;
    for (const d of tag.matchAll(dim)) if (Number(d[1]) <= 8) tiny = true;
    if (!tiny) return src;
  }
  return undefined;
}

const iso = (unix: unknown) => (typeof unix === "number" && Number.isFinite(unix) ? new Date(unix * 1000).toISOString() : undefined);
const isPostId = (v: unknown): v is string => typeof v === "string" && /^post_[0-9a-f-]{36}$/i.test(v);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function get(path: string, key: string, params: URLSearchParams): Promise<Response> {
  return fetch(`${API}${path}?${params}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
}

/** Maps a failed response to an error with a message that is safe to show. */
function failed(res: Response): BeehiivKeyError {
  if (res.status === 401 || res.status === 403) return new BeehiivKeyError("invalid", "beehiiv no longer accepts your key. Replace it in Settings.");
  if (res.status === 404) return new BeehiivKeyError("not-found", "beehiiv can't find that issue. It may have been deleted, or your key may not cover it.");
  if (res.status === 429) return new BeehiivKeyError("rate-limited", "beehiiv says too many requests. Wait a minute and try again.");
  return new BeehiivKeyError("unreachable", "beehiiv had a problem. Try again in a moment.");
}

async function request(path: string, key: string, params: URLSearchParams): Promise<Response> {
  try {
    return await get(path, key, params);
  } catch {
    throw new BeehiivKeyError("unreachable", "Couldn't reach beehiiv. Try again in a moment.");
  }
}

export const ISSUES_PER_PAGE = 5;

export type BeehiivIssuePage = { issues: BeehiivIssue[]; page: number; totalPages: number; totalResults: number };

/** One page of a publication's sent issues, newest first (by publish date). Drafts and scheduled posts are left out. */
export async function listIssues(key: string, publicationId: string, opts: { page?: number; limit?: number } = {}): Promise<BeehiivIssuePage> {
  if (!isPublicationId(publicationId)) throw new BeehiivKeyError("not-found", "That publication isn't valid.");
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const limit = Math.min(100, Math.max(1, Math.floor(opts.limit ?? ISSUES_PER_PAGE)));
  const q = new URLSearchParams({ status: "confirmed", order_by: "publish_date", direction: "desc", limit: String(limit), page: String(page) });
  // Ask for the web HTML too so each issue can show its own first image; if beehiiv refuses the expansion, list without it.
  const withHtml = new URLSearchParams(q);
  withHtml.append("expand[]", "free_web_content");
  let res = await request(`/publications/${publicationId}/posts`, key, withHtml);
  if (res.status === 202 || res.status === 400 || res.status === 422) res = await request(`/publications/${publicationId}/posts`, key, q);
  if (!res.ok) throw failed(res);
  const body = (await res.json().catch(() => null)) as { data?: RawPost[]; total_pages?: unknown; total_results?: unknown } | null;
  const rows = Array.isArray(body?.data) ? body.data : [];
  const issues: BeehiivIssue[] = [];
  for (const p of rows) {
    const publishedAt = iso(p.publish_date) ?? iso(p.displayed_date);
    if (!isPostId(p.id) || !publishedAt) continue;
    issues.push({ id: p.id, title: str(p.title) ?? "Untitled issue", subtitle: str(p.subtitle), publishedAt, url: str(p.web_url), thumbnail: httpsUrl(p.thumbnail_url) ?? firstImage(p.content?.free?.web) });
  }
  const total = num(body?.total_results);
  const pages = num(body?.total_pages) ?? (total !== undefined ? Math.ceil(total / limit) : rows.length >= limit ? page + 1 : page);
  // The API already sorts, but the list is promised newest-first, so do not depend on it.
  issues.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return { issues, page, totalPages: Math.max(1, pages), totalResults: total ?? issues.length };
}

const toClickRow = (c: unknown): ClickRow | null => {
  const r = c as { url?: unknown; email?: ClickRow["email"]; web?: ClickRow["web"] } | null;
  return r && typeof r.url === "string" ? { url: r.url, email: r.email ?? {}, web: r.web ?? {} } : null;
};

/**
 * One issue's web HTML and click counts. beehiiv renders expanded content on demand: a 202 with Retry-After means
 * "not ready yet", so wait and ask again a few times before giving up.
 */
export async function fetchIssue(key: string, publicationId: string, postId: string): Promise<BeehiivIssueContent> {
  if (!isPublicationId(publicationId) || !isPostId(postId)) throw new BeehiivKeyError("not-found", "That issue isn't valid.");
  const q = new URLSearchParams();
  q.append("expand[]", "free_web_content");
  q.append("expand[]", "stats");
  let res = await request(`/publications/${publicationId}/posts/${postId}`, key, q);
  for (let attempt = 0; res.status === 202 && attempt < 4; attempt++) {
    const wait = Number(res.headers.get("retry-after"));
    await sleep(Math.min(Number.isFinite(wait) && wait > 0 ? wait : 2, 5) * 1000);
    res = await request(`/publications/${publicationId}/posts/${postId}`, key, q);
  }
  if (res.status === 202) throw new BeehiivKeyError("unreachable", "beehiiv is still preparing this issue. Try again in a moment.");
  if (!res.ok) throw failed(res);

  const p = ((await res.json().catch(() => null)) as { data?: RawPost } | null)?.data;
  const html = str(p?.content?.free?.web);
  if (!p || !html) {
    throw new BeehiivKeyError("no-content", "beehiiv didn't return this issue's web content. Issues that are only sent by email, or fully paywalled, can't be picked from.");
  }
  const clicks = (Array.isArray(p.stats?.clicks) ? p.stats.clicks : []).map(toClickRow).filter((c): c is ClickRow => c !== null);
  return { id: postId, title: str(p.title) ?? "Untitled issue", publishedAt: iso(p.publish_date) ?? iso(p.displayed_date) ?? new Date().toISOString(), url: str(p.web_url), html, clicks };
}
