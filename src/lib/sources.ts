import { cookies } from "next/headers";
import { BeehiivKeyError, fetchIssue, listIssues, type BeehiivIssueContent } from "./beehiiv";
import { getBeehiivConnection, loadBeehiivKey } from "./connections";
import type { IssueData } from "./demo";
import { parseOwnMode } from "./flow";
import { parseChunks } from "./pollen/chunks";
import { contentRoot } from "./pollen/content";
import { parseActivities } from "./pollen/parse";
import { mergeClicks, rankActivities } from "./pollen/rank";
import { SESSION_COOKIE, readUid } from "./session";

/**
 * The issue a signed-in user creates and sends posts from, for the content source `mode`.
 *   "own:<publication id>:<post id>"  one of the user's own beehiiv issues ("own" alone: their newest)
 *   "public"                          not built yet
 *
 * The sample issue (loadDemoIssue in ./demo) is deliberately NOT returned here. It powers the public /demo flow only and
 * must never reach Buffer: the signed-in pages and /api/draft all load their content through this function, so a sample
 * pick can't become a draft.
 */
export type IssueResult = { issue: IssueData } | { error: string };

export async function loadAppIssueResult(mode: string | undefined): Promise<IssueResult | null> {
  const own = parseOwnMode(mode);
  if (!own) return null; // public newsletters arrive later
  try {
    const uid = readUid((await cookies()).get(SESSION_COOKIE)?.value);
    if (!uid) return { error: "Log in again to continue." };
    const conn = await getBeehiivConnection(uid);
    if (!conn || conn.publications.length === 0) return { error: "Connect your beehiiv key first." };
    // Only publications the saved key was seen to cover; beehiiv enforces the rest.
    const publicationId = own.publicationId ?? conn.publications[0].id;
    if (!conn.publications.some((p) => p.id === publicationId)) return { error: "That publication isn't covered by your key." };
    const key = await loadBeehiivKey(uid);
    if (!key) return { error: "Connect your beehiiv key first." };
    const postId = own.postId ?? (await listIssues(key, publicationId, { limit: 1 })).issues[0]?.id;
    if (!postId) return { error: "This publication has no sent issues yet." };

    const raw = await cachedIssue(`${uid}:${postId}`, () => fetchIssue(key, publicationId, postId));
    const issue = buildIssue(raw);
    if (issue.chunks.length === 0) return { error: "Couldn't find any content to pick from in this issue." };
    return { issue };
  } catch (e) {
    if (e instanceof BeehiivKeyError) return { error: e.message };
    console.error("loading the issue failed:", (e as Error).message);
    return { error: "Couldn't load this issue. Try again in a moment." };
  }
}

/** The issue, or null when it can't be loaded (the later steps just send the user back to the source step). */
export async function loadAppIssue(mode: string | undefined): Promise<IssueData | null> {
  const r = await loadAppIssueResult(mode);
  return r && "issue" in r ? r.issue : null;
}

/** Same ranking as the demo, against today's date: upcoming activities ordered by unique verified clickers. */
function buildIssue(raw: BeehiivIssueContent): IssueData {
  const html = contentRoot(raw.html);
  const today = new Date().toISOString().slice(0, 10);
  const ranked = rankActivities(parseActivities(html, { reference: raw.publishedAt.slice(0, 10) }), mergeClicks(raw.clicks), { today, onlyUpcoming: true });
  const byKey = new Map(ranked.filter((r) => r.rank && r.key).map((r) => [r.key!, r]));
  const chunks = parseChunks(html).map((c) => {
    const r = c.key ? byKey.get(c.key) : undefined;
    return { ...c, rank: r?.rank ?? null, score: r?.stats?.score ?? null };
  });
  return { title: raw.title, publishedAt: raw.publishedAt, url: raw.url ?? "", chunks, hasClicks: raw.clicks.length > 0 };
}

// Every step reloads the issue, and beehiiv renders expanded content on demand, so keep a fetched issue for a few minutes.
const TTL_MS = 5 * 60_000;
const cache = new Map<string, { at: number; value: BeehiivIssueContent }>();
async function cachedIssue(key: string, load: () => Promise<BeehiivIssueContent>): Promise<BeehiivIssueContent> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = await load(); // failures are not cached
  cache.set(key, { at: Date.now(), value });
  for (const [k, v] of cache) if (cache.size > 20 || Date.now() - v.at >= TTL_MS) cache.delete(k);
  return value;
}
