// Server-only: creating one post on one Buffer channel (as a draft, or published straight away), and looking a post up
// again afterwards. Both /api/draft and /api/post-status go through here, so the two paths can't drift apart.

import { gql, isRateLimited } from "./buffer";
import { fitFor } from "./caption";
import { IMAGE_BYTE_LIMITS, serviceKey, serviceLabel } from "./channels";
import { fakeBehaviour, fakeEnforcesLimits, fakeMode, takeFakeRateLimit } from "./fake";

/** "draft" saves to Buffer without publishing. "now" publishes immediately and can't be undone from here. */
export type PostIntent = "draft" | "now";

/** Buffer's ShareMode value for "publish now" (docs: addToQueue, shareNext, shareNow, customScheduled). */
export const NOW_MODE = "shareNow";

// Fake mode (see ./fake.ts): no call to Buffer, realistic results instead.
export { fakeMode };
const FAKE_PUBLISH_MS = 6000;
const CREATE_TIMEOUT_MS = 25_000;

/** A PDF to post as one document (LinkedIn's swipeable carousel): Buffer's `document` asset needs all three. */
export type PostDocument = { url: string; thumbnailUrl: string; title: string };
export type ChannelPostInput = {
  channelId: string;
  service: string;
  text: string;
  images: string[];
  /** Alt text for each image, in the same order (see slides/alt.ts). Sent as `metadata.altText`; a slide without one just has none. */
  alts?: string[];
  /** When set, the post carries this one document instead of the images. */
  document?: PostDocument;
  intent: PostIntent;
};
export type ChannelPostOutcome =
  /** `altDropped`: the network refused the alt text, so the post was created again without it (a refusal means nothing was created, so that is safe). */
  | { ok: true; postId: string; altDropped?: true }
  /** `unknown`: the request died or Buffer errored mid-way, so the post may or may not exist. Never retry these blindly. `rateLimited`: Buffer said it is limiting requests (a 429, or RATE_LIMIT_EXCEEDED in the answer), so nothing was created and it is safe to try again later. */
  | { ok: false; error: string; unknown?: boolean; rateLimited?: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The `assets` list of a post: one document, or the images with their alt text (`metadata.altText`, per Buffer's image-asset input). */
export function assetsFor(p: Pick<ChannelPostInput, "images" | "alts" | "document">, withAlts = true): string {
  if (p.document) return `{ document: { url: ${JSON.stringify(p.document.url)}, thumbnailUrl: ${JSON.stringify(p.document.thumbnailUrl)}, title: ${JSON.stringify(p.document.title)} } }`;
  return p.images
    .map((u, i) => {
      const alt = withAlts ? p.alts?.[i]?.trim() : "";
      return alt ? `{ image: { url: ${JSON.stringify(u)}, metadata: { altText: ${JSON.stringify(alt)} } } }` : `{ image: { url: ${JSON.stringify(u)} } }`;
    })
    .join(", ");
}

export async function createChannelPost(token: string, p: ChannelPostInput): Promise<ChannelPostOutcome> {
  if (fakeMode()) return fakeCreate(p);
  const first = await createOnce(token, p, true);
  // A network that won't take the alt text refuses the post by name ("...altText..."). That is a plain refusal (nothing was created, not even a
  // maybe), so the same post can go once more without it: a missing description is better than a missing post.
  if (!first.ok && !first.unknown && !first.rateLimited && !p.document && p.alts?.some((a) => a?.trim()) && /\balt/i.test(first.error)) {
    console.warn(`[buffer] ${p.service} refused the alt text (${first.error}); sending the post without it`);
    const second = await createOnce(token, p, false);
    return second.ok ? { ...second, altDropped: true } : second;
  }
  return first;
}

async function createOnce(token: string, p: ChannelPostInput, withAlts: boolean): Promise<ChannelPostOutcome> {
  const assets = assetsFor(p, withAlts);
  const metadata = p.service.toLowerCase() === "instagram" ? "metadata: { instagram: { type: post, shouldShareToFeed: true } }" : "";
  const query = `mutation {
    createPost(input: {
      text: ${JSON.stringify(p.text)}
      channelId: ${JSON.stringify(p.channelId)}
      schedulingType: automatic
      mode: ${p.intent === "now" ? NOW_MODE : "addToQueue"}
      ${p.intent === "now" ? "" : "saveToDraft: true"}
      ${metadata}
      assets: [${assets}]
    }) {
      ... on PostActionSuccess { post { id } }
      ... on MutationError { message }
    }
  }`;
  try {
    const r = await gql<{ createPost: { post?: { id: string }; message?: string } }>(token, query, { timeoutMs: CREATE_TIMEOUT_MS });
    const cp = r.data?.createPost;
    if (!r.errors?.length && cp?.post) return { ok: true, postId: cp.post.id };
    // Buffer limits requests per app, shared by everyone using it, so a big send can run into it. It is a clean failure
    // (nothing was created), but retrying straight away won't help.
    if (isRateLimited(r)) return { ok: false, error: "Buffer is limiting requests from this app right now. Try again in a few minutes.", rateLimited: true };
    const error = cp?.message ?? r.errors?.[0]?.message ?? `Buffer returned ${r.status}`;
    // A 5xx on a publish may have gone through on Buffer's side: don't call it a clean failure.
    return { ok: false, error, unknown: p.intent === "now" && r.status >= 500 };
  } catch (e) {
    // Timeout or dropped connection: for a publish we can't know whether Buffer accepted it.
    return { ok: false, error: e instanceof Error ? e.message : String(e), unknown: p.intent === "now" };
  }
}

export type PostState = {
  /** Buffer's PostStatus: draft | scheduled | sending | sent | error | needs_approval. */
  status: string;
  sentAt?: string | null;
  /** The post's URL on the network, once it is live. */
  externalLink?: string | null;
};

export async function getPostState(token: string, id: string): Promise<PostState | { error: string }> {
  if (fakeMode()) return fakeState(id);
  try {
    const r = await gql<{ post: (PostState & { id: string }) | null }>(
      token,
      `{ post(input: { id: ${JSON.stringify(id)} }) { id status sentAt externalLink } }`,
      { timeoutMs: 15_000 },
    );
    const post = r.data?.post;
    if (!post) return { error: r.errors?.[0]?.message ?? `Buffer returned ${r.status}` };
    return { status: post.status, sentAt: post.sentAt ?? null, externalLink: post.externalLink ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Several posts in one request: one aliased field per post, so checking 30 posts costs one request against Buffer's rate limit
 * (which is per app and shared by every user), not 30. Buffer allows up to 30 aliases per query; stay under it.
 */
const ALIASES_PER_REQUEST = 25;
/** `notFound`: Buffer answered NOT_FOUND for this post, i.e. it was deleted (or never existed for this account). Different from a failed lookup. */
export type PostLookupError = { error: string; notFound?: boolean };
export async function getPostStates(token: string, ids: string[]): Promise<Record<string, PostState | PostLookupError>> {
  const out: Record<string, PostState | PostLookupError> = {};
  if (fakeMode()) {
    for (const id of ids) out[id] = fakeState(id);
    return out;
  }
  let limited = false;
  for (let i = 0; i < ids.length; i += ALIASES_PER_REQUEST) {
    const chunk = ids.slice(i, i + ALIASES_PER_REQUEST);
    // Once Buffer has said "too many requests", asking again straight away only makes it worse for every other call (sends share this limit).
    if (limited) {
      for (const id of chunk) out[id] = { error: "Buffer is limiting requests right now." };
      continue;
    }
    const fields = chunk.map((id, k) => `p${k}: post(input: { id: ${JSON.stringify(id)} }) { id status sentAt externalLink }`).join("\n");
    try {
      const r = await gql<Record<string, (PostState & { id: string }) | null>>(token, `{ ${fields} }`, { timeoutMs: 15_000 });
      // Each post gets the error that names its own alias; an error about the whole request (no path) is the fallback for every post without one.
      const wholeRequest = r.errors?.find((e) => !e.path?.length);
      chunk.forEach((id, k) => {
        const alias = `p${k}`;
        const post = r.data?.[alias];
        if (post) {
          out[id] = { status: post.status, sentAt: post.sentAt ?? null, externalLink: post.externalLink ?? null };
          return;
        }
        const own = r.errors?.find((e) => e.path?.[0] === alias);
        const why = own ?? wholeRequest;
        if (r.status === 429 || why?.extensions?.code === "RATE_LIMIT_EXCEEDED") {
          limited = true;
          out[id] = { error: "Buffer is limiting requests right now." };
        }
        else if (own?.extensions?.code === "NOT_FOUND") out[id] = { error: own.message, notFound: true };
        else out[id] = { error: why?.message ?? `Buffer returned ${r.status}` };
      });
    } catch (e) {
      for (const id of chunk) out[id] = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return out;
}

// ---- fake mode ----------------------------------------------------------------------------------------------------

async function fakeCreate(p: ChannelPostInput): Promise<ChannelPostOutcome> {
  if (takeFakeRateLimit()) return { ok: false, error: "Fake mode: Buffer says too many requests.", rateLimited: true };
  await sleep(500 + Math.random() * 1200);
  const svc = p.service.toLowerCase();
  const fit = fitFor(svc, p.text);
  if (fakeEnforcesLimits() && p.intent === "now" && !fit.fits) return { ok: false, error: `${serviceLabel(svc)} posts cannot exceed ${fit.limit} characters.` };
  if (p.document) console.log(`[fake] ${svc}: one document, "${p.document.title}" (${p.document.url}), thumbnail ${p.document.thumbnailUrl}`);
  else if (p.alts?.some(Boolean)) console.log(`[fake] ${svc}: ${p.images.length} slides, alt text on ${p.alts.filter((a) => a?.trim()).length}`);
  if (fakeEnforcesLimits() && !p.document) {
    const tooBig = await fakeImageProblem(svc, p.images);
    if (tooBig) return { ok: false, error: tooBig };
  }
  if (fakeEnforcesLimits() && p.document) {
    const bad = await fakeDocumentProblem(svc, p.document);
    if (bad) return { ok: false, error: bad };
  }
  const behaviour = fakeBehaviour(svc);
  if (behaviour === "fail") return { ok: false, error: "Fake mode: Buffer rejected this post." };
  if (behaviour === "unknown")
    return { ok: false, error: "Fake mode: the request timed out.", unknown: p.intent === "now" };
  return { ok: true, postId: `fake-${p.intent}-${Date.now()}-${svc}` };
}

/**
 * With limits on, fake mode downloads each slide the way Buffer would and refuses one over the network's size limit (Bluesky: 1 MB). The sizes are
 * logged either way, so the dev terminal shows what each network was sent. A slide that can't be fetched here is not a reason to fail: it is skipped.
 */
export async function fakeImageProblem(svc: string, images: string[]): Promise<string | null> {
  const limit = IMAGE_BYTE_LIMITS[serviceKey(svc)];
  const kb = (n: number) => `${Math.round(n / 1000)} KB`;
  const sizes = await Promise.all(
    images.map(async (u, i) => {
      try {
        const res = await fetch(u, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
        const bytes = (await res.arrayBuffer()).byteLength;
        console.log(`[fake] ${svc} slide ${i + 1}: HTTP ${res.status}, ${res.headers.get("content-type") ?? "?"}, ${kb(bytes)}${limit ? ` (limit ${kb(limit)})` : ""}`);
        return { i, status: res.status, bytes };
      } catch (e) {
        console.warn(`[fake] ${svc} slide ${i + 1}: couldn't check it (${e instanceof Error ? e.message : e})`);
        return null;
      }
    }),
  );
  for (const s of sizes) {
    if (!s) continue;
    if (s.status >= 400) return `${serviceLabel(svc)} couldn't download slide ${s.i + 1} (HTTP ${s.status}).`;
    if (limit && s.bytes > limit) return `${serviceLabel(svc)} images cannot exceed ${kb(limit)}. Slide ${s.i + 1} is ${kb(s.bytes)}.`;
  }
  return null;
}

/** Buffer takes one PDF of up to 100 MB and 300 pages on LinkedIn. With limits on, fake mode fetches it the way Buffer would and checks it opens, is a PDF and is not too big. */
const DOCUMENT_BYTE_LIMIT = 100_000_000;
export async function fakeDocumentProblem(svc: string, doc: PostDocument): Promise<string | null> {
  try {
    const res = await fetch(doc.url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    const buf = Buffer.from(await res.arrayBuffer());
    console.log(`[fake] ${svc} document: HTTP ${res.status}, ${res.headers.get("content-type") ?? "?"}, ${Math.round(buf.length / 1000)} KB`);
    if (res.status >= 400) return `${serviceLabel(svc)} couldn't download the document (HTTP ${res.status}).`;
    if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") return `${serviceLabel(svc)} documents must be PDF files.`;
    if (buf.length > DOCUMENT_BYTE_LIMIT) return `${serviceLabel(svc)} documents cannot exceed ${DOCUMENT_BYTE_LIMIT / 1_000_000} MB.`;
  } catch (e) {
    console.warn(`[fake] ${svc} document: couldn't check it (${e instanceof Error ? e.message : e})`);
  }
  return null;
}

function fakeState(id: string): PostState | { error: string } {
  const m = /^fake-(draft|now)-(\d+)-(.+)$/.exec(id);
  if (!m) return { error: "Fake mode: unknown post." };
  const [, intent, ts, svc] = m;
  if (intent === "draft") return { status: "draft" };
  if (Date.now() - Number(ts) < FAKE_PUBLISH_MS) return { status: "sending" };
  if (fakeBehaviour(svc) === "publish_fail") return { status: "error" };
  return { status: "sent", sentAt: new Date().toISOString(), externalLink: `https://example.com/fake-post/${svc}/${ts}` };
}
