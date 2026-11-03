import { cookies } from "next/headers";
import { BeehiivKeyError, fetchIssue, listIssues, type BeehiivIssueContent } from "./beehiiv";
import { getBeehiivConnection, loadBeehiivKey } from "./connections";
import type { IssueData } from "./demo";
import { parseOwnMode } from "./flow";
import { issueKey, listCustomChunks } from "./customPicks";
import { parseChunks } from "./pollen/chunks";
import { contentRoot } from "./pollen/content";
import { parseActivities } from "./pollen/parse";
import { renderableDocument } from "./pollen/render";
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

/** The user's raw issue (from beehiiv, cached a few minutes) and who/what it belongs to, or an error to show. */
type Loaded = { uid: string; issue: string; raw: BeehiivIssueContent; postId: string };

/** `asUid`: the user is already known (a signed slide-preview URL), so the session cookie is not read. */
async function loadRaw(mode: string | undefined, asUid?: string): Promise<Loaded | { error: string } | null> {
  const own = parseOwnMode(mode);
  if (!own) return null; // public newsletters arrive later
  try {
    const uid = asUid ?? readUid((await cookies()).get(SESSION_COOKIE)?.value);
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
    return { uid, issue: issueKey(publicationId, postId), raw, postId };
  } catch (e) {
    if (e instanceof BeehiivKeyError) return { error: e.message };
    console.error("loading the issue failed:", (e as Error).message);
    return { error: "Couldn't load this issue. Try again in a moment." };
  }
}

export async function loadAppIssueResult(mode: string | undefined, asUid?: string): Promise<IssueResult | null> {
  const loaded = await loadRaw(mode, asUid);
  if (!loaded) return null;
  if ("error" in loaded) return loaded;
  try {
    const issue = buildIssue(loaded.raw);
    await dumpForDebugging(loaded.postId, loaded.raw, issue);
    // The user's highlights from the Manual tab are extra chunks of this issue, so every later step finds them by id.
    issue.chunks.push(...(await listCustomChunks(loaded.uid, loaded.issue)));
    return { issue };
  } catch (e) {
    console.error("preparing the issue failed:", (e as Error).message);
    return { error: "Couldn't load this issue. Try again in a moment." };
  }
}

/** Who and which issue a Manual-tab request is about, for saving or removing highlights. */
export async function resolveIssueOwner(mode: string | undefined): Promise<{ uid: string; issue: string } | { error: string } | null> {
  const loaded = await loadRaw(mode);
  return !loaded || "error" in loaded ? loaded : { uid: loaded.uid, issue: loaded.issue };
}

/** The issue as published, ready for a sandboxed iframe (the Manual tab). */
export async function loadAppIssueDocument(mode: string | undefined): Promise<{ html: string } | { error: string } | null> {
  const loaded = await loadRaw(mode);
  if (!loaded || "error" in loaded) return loaded;
  const html = renderableDocument(loaded.raw.html);
  return html ? { html } : { error: "Couldn't show this issue as published." };
}

/** The issue, or null when it can't be loaded (the later steps just send the user back to the source step). */
export async function loadAppIssue(mode: string | undefined, asUid?: string): Promise<IssueData | null> {
  const r = await loadAppIssueResult(mode, asUid);
  return r && "issue" in r ? r.issue : null;
}

/**
 * Development only: keep the raw beehiiv HTML and what the parser made of it under .next/pollen-debug/, so a layout the
 * parser doesn't handle can be reproduced from the real response. Never runs in production.
 */
async function dumpForDebugging(postId: string, raw: BeehiivIssueContent, issue: IssueData): Promise<void> {
  if (process.env.NODE_ENV !== "development") return;
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const dir = ".next/pollen-debug";
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/${postId}.html`, raw.html);
    await writeFile(`${dir}/${postId}.json`, JSON.stringify({ title: raw.title, publishedAt: raw.publishedAt, clicks: raw.clicks, chunks: issue.chunks.length, ranked: issue.chunks.filter((c) => c.rank).length }, null, 2));
  } catch {
    // debugging aid only
  }
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
