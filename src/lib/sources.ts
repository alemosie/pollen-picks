import { cookies } from "next/headers";
import { BeehiivKeyError, fetchIssue, listIssues, type BeehiivIssueContent } from "./beehiiv";
import { getBeehiivConnection, loadBeehiivKey } from "./connections";
import type { IssueData } from "./demo";
import { linkMode, parseLinkMode, parseOwnMode } from "./flow";
import { loadPublicSource } from "./publicSources";
import { readPublicPost } from "./publicPost";
import { issueKey, listCustomChunks } from "./customPicks";
import { parseChunks } from "./pollen/chunks";
import { contentRoot } from "./pollen/content";
import { extractIssueImages } from "./pollen/images";
import { renderableDocument } from "./pollen/render";
import { mergeClicks } from "./pollen/rank";
import { rankChunks, withDates } from "./pollen/rankChunks";
import { SESSION_COOKIE, readUid } from "./session";

/**
 * The issue a signed-in user creates and sends posts from, for the content source `mode`.
 *   "own:<publication id>:<post id>"  one of the user's own beehiiv issues ("own" alone: their newest)
 *   "link:<source id>"                a public newsletter post the user pasted a link to (Manual picking only)
 *
 * The sample issue (loadDemoIssue in ./demo) is deliberately NOT returned here. It powers the public /demo flow only and
 * must never reach Buffer: the signed-in pages and /api/draft all load their content through this function, so a sample
 * pick can't become a draft.
 */
export type IssueResult = { issue: IssueData } | { error: string };

/** The user's raw issue (from beehiiv, cached a few minutes) and who/what it belongs to, or an error to show. */
type Loaded = { uid: string; issue: string; raw: BeehiivIssueContent; postId: string; newsletter: string; publication?: { logo?: string; organization?: string } };

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
    const pub = conn.publications.find((p) => p.id === publicationId);
    const newsletter = pub?.name?.trim() || "this newsletter";
    return { uid, issue: issueKey(publicationId, postId), raw, postId, newsletter, publication: { logo: pub?.logo, organization: pub?.organization } };
  } catch (e) {
    if (e instanceof BeehiivKeyError) return { error: e.message };
    console.error("loading the issue failed:", (e as Error).message);
    return { error: "Couldn't load this issue. Try again in a moment." };
  }
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "this newsletter";
  }
};

/** A public post: no parsed chunks or clicks, only the user's highlights from it. */
async function loadLinkIssue(id: string, asUid?: string): Promise<IssueResult> {
  try {
    const uid = asUid ?? readUid((await cookies()).get(SESSION_COOKIE)?.value);
    if (!uid) return { error: "Log in again to continue." };
    const source = await loadPublicSource(id);
    if (!source) return { error: "That link isn't available any more. Choose a source again." };
    const publishedAt = source.publishedAt ?? new Date().toISOString();
    const chunks = withDates(await listCustomChunks(uid, linkMode(id)), publishedAt.slice(0, 10)).map((c) => ({ ...c, rank: null, score: null }));
    return {
      issue: {
        title: source.title,
        newsletter: source.site || hostOf(source.url),
        author: source.author,
        publishedAt,
        url: source.url,
        thumbnail: source.image ?? undefined,
        chunks,
        hasClicks: false,
        // Always a list, even an empty one: its being set is what turns on the picture row for the picks (the pages they link to are read from there).
        images: extractIssueImages("", { base: source.url, thumbnail: source.image ?? undefined }),
      },
    };
  } catch (e) {
    console.error("loading the public post failed:", (e as Error).message);
    return { error: "Couldn't load this post. Try again in a moment." };
  }
}

export async function loadAppIssueResult(mode: string | undefined, asUid?: string): Promise<IssueResult | null> {
  const link = parseLinkMode(mode);
  if (link) return loadLinkIssue(link.id, asUid);
  const loaded = await loadRaw(mode, asUid);
  if (!loaded) return null;
  if ("error" in loaded) return loaded;
  try {
    const issue = buildIssue(loaded.raw, loaded.newsletter);
    issue.publication = loaded.publication;
    await dumpForDebugging(loaded.postId, loaded.raw, issue);
    // The user's highlights from the Manual tab are extra chunks of this issue, so every later step finds them by id.
    issue.chunks.push(...withDates(await listCustomChunks(loaded.uid, loaded.issue), issue.publishedAt.slice(0, 10)));
    return { issue };
  } catch (e) {
    console.error("preparing the issue failed:", (e as Error).message);
    return { error: "Couldn't load this issue. Try again in a moment." };
  }
}

/** Who and which issue a Manual-tab request is about, for saving or removing highlights. */
export async function resolveIssueOwner(mode: string | undefined): Promise<{ uid: string; issue: string } | { error: string } | null> {
  const link = parseLinkMode(mode);
  if (link) {
    const uid = readUid((await cookies()).get(SESSION_COOKIE)?.value);
    if (!uid) return { error: "Log in again to continue." };
    return (await loadPublicSource(link.id)) ? { uid, issue: linkMode(link.id) } : { error: "That link isn't available any more. Choose a source again." };
  }
  const loaded = await loadRaw(mode);
  return !loaded || "error" in loaded ? loaded : { uid: loaded.uid, issue: loaded.issue };
}

/** The issue as published, ready for a sandboxed iframe (the Manual tab). */
export async function loadAppIssueDocument(mode: string | undefined): Promise<{ html: string } | { error: string } | null> {
  const link = parseLinkMode(mode);
  if (link) {
    try {
      const uid = readUid((await cookies()).get(SESSION_COOKIE)?.value);
      if (!uid) return { error: "Log in again to continue." };
      const source = await loadPublicSource(link.id);
      if (!source) return { error: "That link isn't available any more. Choose a source again." };
      const r = await readPublicPost(source.url, uid);
      return "error" in r ? { error: r.error } : { html: r.post.html };
    } catch (e) {
      console.error("showing the public post failed:", (e as Error).message);
      return { error: "Couldn't show this post. Try again in a moment." };
    }
  }
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

/** Upcoming items ordered by unique verified clickers, for any layout (see rankChunks), against today's date. */
export function buildIssue(raw: BeehiivIssueContent, newsletter: string): IssueData {
  const html = contentRoot(raw.html);
  const today = new Date().toISOString().slice(0, 10);
  const parsed = parseChunks(html);
  const ranks = rankChunks(parsed, mergeClicks(raw.clicks), { today, reference: raw.publishedAt.slice(0, 10) });
  const chunks = withDates(parsed, raw.publishedAt.slice(0, 10)).map((c) => ({ ...c, rank: ranks.get(c.id)?.rank ?? null, score: ranks.get(c.id)?.score ?? null }));
  // The Top clicks tab needs something to rank: click rows alone (the footer, a story, events that are over) would open it onto an empty list.
  return { title: raw.title, newsletter, publishedAt: raw.publishedAt, url: raw.url ?? "", chunks, hasClicks: ranks.size > 0, images: extractIssueImages(raw.html, { base: raw.url, thumbnail: raw.thumbnail }) };
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
