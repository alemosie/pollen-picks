// Server-only: which Instagram account owns a post. Answers are cached forever in public.instagram_handles
// (db/supabase/0008_instagram_handles.sql); a miss asks Apify's Instagram Post Scraper, on the app's own Apify token.

import { loadApifyKey } from "./connections";
import { db } from "./db";
import { instagramHandle, instagramPostCode, instagramPostKey, type KnownHandles } from "./pollen/url";

/** Apify's "Instagram Post Scraper". Override with APIFY_ACTOR_ID to try another actor with the same input and output. */
const ACTOR = process.env.APIFY_ACTOR_ID || "nH2AHrwxeTRJoN5hX";
const TIMEOUT_MS = 40_000;

const intEnv = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return process.env[name] !== undefined && process.env[name] !== "" && Number.isInteger(n) && n >= 0 ? n : fallback;
};
/** New lookups a signed-in user outside APIFY_ALLOWED_EMAILS gets on the app's token, once. After that: their own token (not built yet). */
const freeLookups = () => intEnv("APIFY_FREE_LOOKUPS", 20);
/** Most new lookups, for everyone together, per calendar month (UTC). The brake that keeps one busy month from draining the shared Apify credit. */
const monthlyCap = () => intEnv("APIFY_MONTHLY_CAP", 1000);

/** Cached owners for the posts among `urls`, keyed like `instagramTag` expects. A database problem means "none known", never a failed page. */
export async function knownHandles(urls: (string | null | undefined)[]): Promise<KnownHandles> {
  const byCode = new Map<string, string>();
  for (const u of urls) {
    const code = instagramPostCode(u);
    const key = instagramPostKey(u);
    if (code && key) byCode.set(code, key);
  }
  if (byCode.size === 0) return {};
  try {
    const { data, error } = await db().from("instagram_handles").select("shortcode, handle").in("shortcode", [...byCode.keys()]);
    if (error) throw new Error(error.message);
    const out: KnownHandles = {};
    for (const r of (data ?? []) as { shortcode: string; handle: string }[]) {
      const key = byCode.get(r.shortcode);
      if (key) out[key] = r.handle;
    }
    return out;
  } catch (e) {
    console.error("reading cached Instagram handles failed:", (e as Error).message);
    return {};
  }
}

/** Cached owners for the picked chunks' post links (one query). Pass the result to slideItemsFor / captionItemsFor. */
export const knownForPicks = (chunks: { id: number; url: string | null }[], ids: number[]): Promise<KnownHandles> => {
  const picked = new Set(ids);
  return knownHandles(chunks.filter((c) => picked.has(c.id)).map((c) => c.url));
};

/** Entries of APIFY_ALLOWED_EMAILS: "name@x.com" matches that address, "@x.com" matches the whole domain. */
function allowList(): string[] {
  return (process.env.APIFY_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
export const emailMayUseServerToken = (email: string | null | undefined): boolean => {
  const e = email?.trim().toLowerCase();
  return !!e && allowList().some((a) => (a.startsWith("@") ? e.endsWith(a) : e === a));
};

async function userEmail(userId: string): Promise<string | null> {
  const { data, error } = await db().from("users").select("email").eq("id", userId).maybeSingle();
  if (error) throw new Error(`Could not read the user: ${error.message}`);
  return typeof data?.email === "string" ? data.email : null;
}

/** Apify's own name for why it refused a request ("token-not-found", "insufficient-permissions"…), for the server log. */
async function refusalReason(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { type?: unknown } } | null;
  return typeof body?.error?.type === "string" ? body.error.type : "no reason given";
}

/** How many lookups this user has sent to Apify (each post counts once). */
async function lookupsUsedBy(userId: string): Promise<number> {
  const { count, error } = await db().from("instagram_lookups").select("shortcode", { count: "exact", head: true }).eq("user_id", userId);
  if (error) throw new Error(`Could not count lookups: ${error.message}`);
  return count ?? 0;
}

/** New lookups on the app's token so far this calendar month, everyone together (UTC). Lookups on a user's own token don't count. */
async function lookupsThisMonth(): Promise<number> {
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { count, error } = await db().from("instagram_lookups").select("shortcode", { count: "exact", head: true }).gte("created_at", since);
  if (error) throw new Error(`Could not count this month's lookups: ${error.message}`);
  return count ?? 0;
}

/** What a user may still do on the app's token, for the Settings page. `unlimited`: their email is in APIFY_ALLOWED_EMAILS. */
export async function lookupAllowance(userId: string): Promise<{ free: number; used: number; unlimited: boolean; buffer: boolean }> {
  const email = await userEmail(userId);
  const unlimited = emailMayUseServerToken(email);
  return { free: freeLookups(), used: unlimited ? 0 : await lookupsUsedBy(userId), unlimited, buffer: !!email?.trim().toLowerCase().endsWith("@buffer.com") };
}

export type LookupResult =
  | { handle: string; cached: boolean }
  | { error: "invalid" | "limit-reached" | "capped" | "unavailable" | "own-token" | "not-found" | "failed" };

/**
 * Asks Apify who owns one post or reel. No access rules here: callers decide who may spend the token. Null when the answer
 * isn't a usable handle; throws a LookupFailure for everything else.
 */
export class LookupFailure extends Error {
  constructor(readonly kind: "unavailable" | "failed") {
    super(kind);
  }
}
export async function fetchPostOwner(key: string, code: string, token: string | undefined = process.env.APIFY_TOKEN): Promise<string | null> {
  if (!token) throw new LookupFailure("unavailable");
  let handle: string | null;
  try {
    // One post, one run: the actor answers with a dataset row whose ownerUsername is the account.
    const res = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?timeout=${TIMEOUT_MS / 1000 - 5}&format=json&clean=true`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ username: [`https://www.instagram.com/${key.split("/")[3]}/${code}/`], resultsLimit: 1 }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 402 || res.status === 403) {
      // A bad token or no credit: say it plainly in the server log (the status only, never the token).
      console.error(`Apify refused the lookup (HTTP ${res.status}, ${await refusalReason(res)}): a bad token, a token without permission to run this actor, or no credit.`);
      throw new LookupFailure("unavailable");
    }
    if (!res.ok) {
      console.error(`Apify lookup failed (HTTP ${res.status}).`);
      throw new LookupFailure("failed");
    }
    const rows = (await res.json().catch(() => null)) as { ownerUsername?: unknown }[] | null;
    const owner = Array.isArray(rows) ? rows.find((r) => typeof r?.ownerUsername === "string")?.ownerUsername : null;
    handle = typeof owner === "string" ? owner.trim().replace(/^@/, "").toLowerCase() : null;
  } catch (e) {
    if (e instanceof LookupFailure) throw e;
    console.error("Apify lookup failed:", (e as Error).name === "TimeoutError" ? "timed out" : (e as Error).message);
    throw new LookupFailure("failed");
  }
  // instagramHandle() is the same check the rest of the app uses for "is this a real handle".
  return handle && instagramHandle(`https://instagram.com/${handle}`) ? handle : null;
}

/** Stores an answer for everyone. A failure is logged, not thrown: the answer is still good for this request. */
export async function cacheHandle(code: string, handle: string): Promise<void> {
  const { error } = await db().from("instagram_handles").upsert({ shortcode: code, handle }, { onConflict: "shortcode" });
  if (error) console.error("caching the Instagram handle failed:", error.message);
}

/**
 * Owner of one post or reel link, for a signed-in user. Order: the shared cache (free for everyone); the user's own Apify token
 * if they saved one (their credit, no limits of ours); else the app's token: free for APIFY_ALLOWED_EMAILS, otherwise
 * APIFY_FREE_LOOKUPS per user, and for nobody past APIFY_MONTHLY_CAP.
 */
export async function resolvePostHandle(userId: string, url: string): Promise<LookupResult> {
  const code = instagramPostCode(url);
  const key = instagramPostKey(url);
  if (!code || !key) return { error: "invalid" };

  const cached = (await knownHandles([url]))[key];
  if (cached) return { handle: cached, cached: true };

  let ownToken: string | null;
  try {
    ownToken = await loadApifyKey(userId);
    if (!ownToken) {
      if (!process.env.APIFY_TOKEN) return { error: "unavailable" };
      if (!emailMayUseServerToken(await userEmail(userId)) && (await lookupsUsedBy(userId)) >= freeLookups()) return { error: "limit-reached" };
      if ((await lookupsThisMonth()) >= monthlyCap()) {
        console.error(`Instagram lookups paused: the monthly cap of ${monthlyCap()} is reached (APIFY_MONTHLY_CAP).`);
        return { error: "capped" };
      }
    }
  } catch (e) {
    console.error("checking the Instagram lookup limits failed:", (e as Error).message);
    return { error: "failed" };
  }

  let handle: string | null;
  try {
    handle = await fetchPostOwner(key, code, ownToken ?? undefined);
  } catch (e) {
    const kind = e instanceof LookupFailure ? e.kind : "failed";
    // A refused token of the user's own is theirs to fix; the app's own token being refused is ours.
    return { error: kind === "unavailable" && ownToken ? "own-token" : kind };
  }
  if (!handle) return { error: "not-found" };

  await cacheHandle(code, handle);
  if (!ownToken) {
    // Counts against the user's free allowance and the monthly cap. A repeat of the same post is one row.
    const counted = await db().from("instagram_lookups").upsert({ user_id: userId, shortcode: code }, { onConflict: "user_id,shortcode", ignoreDuplicates: true });
    if (counted.error) console.error("counting the Instagram lookup failed:", counted.error.message);
  }
  return { handle, cached: false };
}

/** Is this a token Apify would accept? Asks Apify who the token belongs to, which costs nothing. */
export async function checkApifyKey(token: string): Promise<"ok" | "invalid" | "failed"> {
  try {
    const res = await fetch("https://api.apify.com/v2/users/me", { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) console.error(`Apify token check: HTTP ${res.status}, ${await refusalReason(res)}.`);
    return res.ok ? "ok" : res.status === 401 || res.status === 403 ? "invalid" : "failed";
  } catch {
    return "failed";
  }
}

/** A pasted token, trimmed, or null when it can't be one (empty, spaces inside, odd characters, absurd length). */
export function cleanApifyKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const k = raw.trim();
  return /^[A-Za-z0-9_-]{16,200}$/.test(k) ? k : null;
}
