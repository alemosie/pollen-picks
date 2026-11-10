// Server-only: the send queue. "Send" writes one row per channel into post_history with status 'queued' and returns at once; this file
// is what turns those rows into posts in Buffer. It does not depend on the page that asked: closing the tab or navigating away changes nothing.
//
// Who runs it (all of them are safe together, because a row is claimed with a lease and two workers never get the same one):
//   - right after the request that queued the rows (`after()` in /api/draft),
//   - whenever a page that is watching progress asks (/api/history/refresh), so an open tab makes it quick,
//   - History, whenever it is opened with rows still waiting (it asks /api/history/refresh at once), and its "Check Buffer for updates" button.
// There is no background cron on purpose (Netlify's free plan has a hard monthly credit cap). The only rows that wait for a visit are ones held back
// by a rate limit after the tab was closed.
//
// Never twice: a row that was claimed and then lost (the worker died mid-request) is NOT retried. See claim_queued_posts in 0016: it becomes
// 'unknown' and the person is told to check Buffer. The only automatic retry is Buffer's 429, which means nothing was created.

import { randomUUID } from "node:crypto";
import { MAX_TEMPLATE_CHARS } from "./savedCreationShape";
import type { SupabaseClient } from "@supabase/supabase-js";
import { limitNote } from "./caption";
import { imageLimit, needsSmallImages, serviceKey, serviceLabel, unsupportedReason } from "./channels";
import { siteOrigin } from "./buffer";
import { createChannelPost, fakeMode, type ChannelPostOutcome, type PostDocument } from "./bufferPost";
import { getValidSession } from "./connections";
import { db } from "./db";
import { logDrafts } from "./draftLog";
import { knownForPicks } from "./instagramHandles";
import { signPreview } from "./previewSig";
import { slidePublicUrl, storePdf, storeSlide, type StoredSlide } from "./slideStore";
import { loadAppIssue } from "./sources";
import { planSlides } from "./slides/plan";
import { slideItemsFor } from "./slides/items";
import { parseTemplateFrom, templateParams } from "./slides/options";
import { altTexts } from "./slides/alt";
import { slidesToPdf } from "./slides/pdf";
import { toSmallJpeg } from "./slides/render";
import { prepareSlideSet } from "./slides/slideSet";
import type { PostIntent } from "./bufferPost";

/** How long a claimed row is held. Longer than a Buffer request can take (25 s), so a live worker never loses its row. */
const LEASE_SECONDS = 60;
/** When Buffer says 429: wait this long before the next try, doubling, and give up after MAX_ATTEMPTS. */
const BACKOFF_SECONDS = [20, 40, 80, 160, 300];
const MAX_ATTEMPTS = BACKOFF_SECONDS.length + 1;
/** How long to wait for our own slide renderer before handing the image addresses to Buffer. */
const WARM_TIMEOUT_MS = 12_000;
/** Posts created at the same time. Buffer limits requests per app, so this stays small. */
const PARALLEL = 2;

const clip = (v: string, n: number) => v.replace(/\s+/g, " ").trim().slice(0, n);

// ---- queueing ------------------------------------------------------------------------------------------------------

export type QueueRequest = {
  source: string;
  picks: number[];
  template: string;
  intent: PostIntent;
  newsletter: string;
  issueTitle: string;
  /** `intent` per channel overrides the batch one: a channel whose caption is too long for a publish-now is saved as a draft. */
  channels: { id: string; service: string; name: string; caption: string; intent?: PostIntent }[];
  /** LinkedIn channels get the slides as one PDF (a swipeable carousel) instead of a set of images. The route sets it from the user's LinkedIn format. */
  linkedinPdf?: boolean;
};

/** Writes one row per channel and returns the batch id. Channels that can't take a carousel are logged as failed straight away. */
export async function enqueue(userId: string, r: QueueRequest, client: SupabaseClient = db()): Promise<{ batchId: string }> {
  const batchId = randomUUID();
  const base = (c: QueueRequest["channels"][number]) => ({
    user_id: userId,
    batch_id: batchId,
    channel_id: c.id.slice(0, 100),
    service: clip(c.service.toLowerCase(), 40) || "unknown",
    channel_name: clip(c.name, 120),
    mode: c.intent ?? r.intent,
    newsletter: clip(r.newsletter, 120),
    issue_title: clip(r.issueTitle, 200),
  });
  const rows = r.channels.map((c) => {
    const blocked = unsupportedReason(c.service);
    return blocked
      ? { ...base(c), status: "failed", error: clip(blocked, 200) }
      : {
          ...base(c),
          status: "queued",
          source: r.source.slice(0, 200),
          picks: r.picks,
          template: r.template.slice(0, MAX_TEMPLATE_CHARS),
          caption: c.caption.slice(0, 10_000),
          // Only sent when it is on, and only on LinkedIn rows (see the retry below for a database that doesn't have the column yet).
          ...(r.linkedinPdf && serviceKey(c.service) === "linkedin" ? { as_pdf: true } : {}),
        };
  });
  let { error } = await client.from("post_history").insert(rows);
  // The PDF is what LinkedIn gets by default, so until db/supabase/0028 is applied (no as_pdf column) every LinkedIn send would fail here. It goes
  // as images instead, which is how it worked before: a missing column must not cost anyone their post.
  if (error && /as_pdf/.test(error.message) && rows.some((row) => "as_pdf" in row)) {
    console.error("post_history has no as_pdf column yet (db/supabase/0028); LinkedIn goes as images:", error.message);
    ({ error } = await client.from("post_history").insert(rows.map((row) => Object.fromEntries(Object.entries(row).filter(([k]) => k !== "as_pdf")))));
  }
  if (error) throw new Error(`Could not queue the send: ${error.message}`);
  return { batchId };
}

// ---- working -------------------------------------------------------------------------------------------------------

export type Claimed = {
  id: number;
  user_id: string;
  batch_id: string | null;
  channel_id: string | null;
  service: string;
  mode: PostIntent;
  source: string | null;
  picks: number[] | null;
  template: string | null;
  caption: string | null;
  attempts: number;
  /** The stored slides of this send (db/supabase/0026), set by the first row of the batch to be built. Absent on rows from before it existed. */
  slide_paths?: string[] | null;
  slide_paths_small?: string[] | null;
  /** What each stored slide says, for alt text (db/supabase/0028). Absent on rows from before it existed. */
  slide_alts?: string[] | null;
  /** The send's PDF, stored once for LinkedIn (0028). */
  slide_pdf_path?: string | null;
  /** This channel gets the slides as a PDF (0028). Only ever set on LinkedIn rows. */
  as_pdf?: boolean | null;
  issue_title?: string | null;
  newsletter?: string | null;
};

/** What every channel of one send shares: the slide image addresses (signed for this user), or why they can't be made. */
/** `smallImages` is the same slides as small JPEGs, for the networks that refuse large images (see needsSmallImages); drawn only when a channel needs them. */
export type Context = { images: string[]; smallImages?: string[]; /** Alt text per slide (the same for both sets). */ alts?: string[] } | { problem: string };

export async function warm(urls: string[]): Promise<string | null> {
  const bad = (
    await Promise.all(
      urls.map(async (u, i) => {
        try {
          const res = await fetch(u, { cache: "no-store", signal: AbortSignal.timeout(WARM_TIMEOUT_MS) });
          await res.arrayBuffer();
          return res.ok ? null : `slide ${i + 1}`;
        } catch {
          return null; // slow is not broken: let Buffer try
        }
      }),
    )
  ).filter((v): v is string => v !== null);
  return bad.length ? `Couldn't draw ${bad.join(", ")}, so nothing was sent. Go back to Design and try again.` : null;
}

/** How many slides are drawn at once. They are CPU work in this one process, so a few at a time. */
const DRAW_PARALLEL = 3;

async function drawAll(count: number, draw: (n: number) => Promise<StoredSlide>): Promise<StoredSlide[]> {
  const out: StoredSlide[] = new Array(count);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(DRAW_PARALLEL, count) }, async () => {
      for (;;) {
        const n = next++;
        if (n >= count) return;
        out[n] = await draw(n);
      }
    }),
  );
  return out;
}

/**
 * Draws the slides of this send once, stores them, and remembers where (on every row of the send, so a retry or another channel reuses them and
 * nothing is drawn again from highlights that may be gone by then). Throws if they can't be stored.
 */
async function drawAndStore(row: Claimed, issue: NonNullable<Awaited<ReturnType<typeof loadAppIssue>>>): Promise<{ images: string[]; smallImages?: string[]; alts?: string[] } | { problem: string }> {
  const picks = row.picks ?? [];
  const set = await prepareSlideSet({ issue, ids: picks, template: parseTemplateFrom(new URLSearchParams(row.template ?? "")), uid: row.user_id, ownIssue: true });
  if (!set) return { problem: "No picks." };
  const png = await drawAll(set.count, async (n) => {
    const res = await set.render(n);
    if (!res.ok) throw new Error(`slide ${n + 1} could not be drawn`);
    return { bytes: Buffer.from(await res.arrayBuffer()), type: "image/png" as const };
  });
  const paths = await Promise.all(png.map((s) => storeSlide(row.user_id, s)));
  // The small copy some networks need (see needsSmallImages) is made from the same drawing. If it can't be made, those networks get the full-size one.
  const jpegs = await Promise.all(png.map((s) => toSmallJpeg(s.bytes)));
  const small = jpegs.every((j) => j !== null) ? await Promise.all(jpegs.map((j) => storeSlide(row.user_id, { bytes: j as Buffer, type: "image/jpeg" }))) : null;
  if (row.batch_id) {
    const { error } = await db().from("post_history").update({ slide_paths: paths, slide_paths_small: small }).eq("batch_id", row.batch_id).eq("user_id", row.user_id);
    if (error) console.error("remembering the stored slides failed:", error.message);
    // Apart from the paths, so a database that doesn't have the column yet (0028) can't cost the send its stored slides.
    const alted = await db().from("post_history").update({ slide_alts: set.alts }).eq("batch_id", row.batch_id).eq("user_id", row.user_id);
    if (alted.error) console.error("remembering the alt text failed:", alted.error.message);
  }
  return { images: paths.map(slidePublicUrl), ...(small ? { smallImages: small.map(slidePublicUrl) } : {}), alts: set.alts };
}

/** The old way: addresses that draw each slide when Buffer asks (see previewSig). Only used when slides can't be stored (the bucket isn't set up yet). */
async function signedContext(row: Claimed, issue: NonNullable<Awaited<ReturnType<typeof loadAppIssue>>>): Promise<Context> {
  const picks = row.picks ?? [];
  const tpl = parseTemplateFrom(new URLSearchParams(row.template ?? ""));
  const slides = planSlides(slideItemsFor(issue.chunks, picks, await knownForPicks(issue.chunks, picks)), { newsletter: issue.newsletter, ...tpl });
  const base = (process.env.PUBLIC_BASE_URL ?? siteOrigin()).replace(/\/$/, "");
  if (!fakeMode() && /localhost|127\.0\.0\.1/.test(base)) {
    return { problem: `Slide images are served from ${base}, which Buffer can't reach. Use the deployed site (or set PUBLIC_BASE_URL to a tunnel).` };
  }
  const signed = signPreview(new URLSearchParams([...templateParams(tpl).entries(), ["picks", picks.join(",")], ["mode", row.source ?? ""]]), row.user_id).toString();
  const images = slides.map((_, i) => `${base}/api/slide/preview?${signed}&n=${i}`);
  if (!fakeMode()) {
    const problem = await warm(images);
    if (problem) return { problem };
  }
  const signedSmall = signPreview(new URLSearchParams([...templateParams(tpl).entries(), ["picks", picks.join(",")], ["mode", row.source ?? ""], ["fmt", "jpg"]]), row.user_id).toString();
  const smallImages = slides.map((_, i) => `${base}/api/slide/preview?${signedSmall}&n=${i}`);
  return { images, smallImages, alts: altTexts(slides) };
}

export async function buildContext(row: Claimed): Promise<Context> {
  // Already stored by an earlier try of this send (a rate-limited channel, another channel of the same send): use those, draw nothing.
  if (row.slide_paths?.length) {
    const alts = row.slide_alts?.length === row.slide_paths.length ? row.slide_alts : undefined;
    return { images: row.slide_paths.map(slidePublicUrl), ...(row.slide_paths_small?.length ? { smallImages: row.slide_paths_small.map(slidePublicUrl) } : {}), ...(alts ? { alts } : {}) };
  }
  const issue = await loadAppIssue(row.source ?? "", row.user_id);
  if (!issue) return { problem: "Couldn't load this issue. Log in again from the Source step and send again." };
  if ((row.picks ?? []).length === 0) return { problem: "No picks." };
  // Fake mode only fakes Buffer: the slides are still drawn and stored (in the dev project's bucket), so a dev test exercises the real thing.
  try {
    const stored = await drawAndStore(row, issue);
    if ("problem" in stored) return stored;
    // The stored addresses are public, so check they open before Buffer is given them: a bucket that isn't public would otherwise leave broken images in Buffer.
    const problem = await warm(stored.images);
    if (problem) return { problem };
    return stored;
  } catch (e) {
    console.error("storing the slides failed, using signed links instead:", (e as Error).message);
    return signedContext(row, issue);
  }
}

/**
 * The send's slides as one PDF, for a LinkedIn channel that asked for it (LinkedIn shows a PDF as a swipeable carousel, and a set of images as a
 * cropped grid). Made once per send from the stored slides, stored like them, and remembered on the send's rows so a retry reuses it. Returns null
 * when it can't be made: the channel then gets the slides as images, as if nobody had asked.
 */
export async function makePdf(row: Claimed, ctx: { images: string[]; smallImages?: string[]; alts?: string[] }): Promise<PostDocument | null> {
  // Buffer wants a cover picture too: the first slide, as the small JPEG when there is one.
  const thumbnailUrl = ctx.smallImages?.[0] ?? ctx.images[0];
  const title = clip(row.issue_title || row.newsletter || "Pollen Picks", 100);
  try {
    if (row.slide_pdf_path) return { url: slidePublicUrl(row.slide_pdf_path), thumbnailUrl, title };
    const pages = await Promise.all(
      ctx.images.map(async (u, i) => {
        const res = await fetch(u, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
        if (!res.ok) throw new Error(`slide ${i + 1} (HTTP ${res.status})`);
        return Buffer.from(await res.arrayBuffer());
      }),
    );
    const path = await storePdf(row.user_id, await slidesToPdf(pages, title, ctx.alts));
    if (row.batch_id) {
      const { error } = await db().from("post_history").update({ slide_pdf_path: path }).eq("batch_id", row.batch_id).eq("user_id", row.user_id);
      if (error) console.error("remembering the stored PDF failed:", error.message);
    }
    return { url: slidePublicUrl(path), thumbnailUrl, title };
  } catch (e) {
    console.error("making the PDF failed, sending the slides as images instead:", (e as Error).message);
    return null;
  }
}

/**
 * What the worker needs from the outside. Production passes nothing and gets the real ones; the tests pass fakes (see sendQueue.test.ts),
 * so every rule below can be checked without a database, a Buffer account or a beehiiv key.
 */
export type QueueDeps = {
  db: () => SupabaseClient;
  getValidSession: typeof getValidSession;
  buildContext: (row: Claimed) => Promise<Context>;
  /** Draws slides ahead of Buffer (see warm); null when all were drawn, else why not. */
  warmImages: (urls: string[]) => Promise<string | null>;
  /** The send's slides as one PDF for LinkedIn (see makePdf); null when it can't be made. */
  makePdf: typeof makePdf;
  createChannelPost: typeof createChannelPost;
  logDrafts: typeof logDrafts;
  fakeMode: () => boolean;
};
const realDeps = (): QueueDeps => ({ db, getValidSession, buildContext, warmImages: warm, makePdf, createChannelPost, logDrafts, fakeMode });

async function finish(client: SupabaseClient, row: Claimed, patch: Record<string, unknown>) {
  // The caption is only needed until the post exists, so it is erased when the row is done (created). A failed or unknown row keeps it for
  // CAPTION_KEEP_HOURS so "Retry" / "Send again" has something to send; see purgeStaleCaptions in postHistory.ts.
  const keep = patch.status === "failed" || patch.status === "unknown";
  const { error } = await client.from("post_history").update({ ...(keep ? {} : { caption: null }), lease_until: null, ...patch }).eq("id", row.id).eq("status", "working");
  if (error) console.error("updating the send queue failed:", error.message);
}

async function release(client: SupabaseClient, rows: Claimed[], notBefore?: Date) {
  if (rows.length === 0) return;
  const { error } = await client
    .from("post_history")
    .update({ status: "queued", lease_until: null, ...(notBefore ? { not_before: notBefore.toISOString() } : {}) })
    .in("id", rows.map((r) => r.id))
    .eq("status", "working");
  if (error) console.error("releasing queued posts failed:", error.message);
}

/**
 * Claims due rows (this user's, or anyone's when `userId` is left out) and sends them, until there are none or `deadlineMs` has passed. Whatever
 * is claimed and not reached is put back. Returns how many posts were handled.
 */
export async function processQueue(opts: { userId?: string; limit?: number; deadlineMs?: number } = {}, overrides: Partial<QueueDeps> = {}): Promise<number> {
  const d = { ...realDeps(), ...overrides };
  const client = d.db();
  const deadline = Date.now() + (opts.deadlineMs ?? 8_000);
  const { data, error } = await client.rpc("claim_queued_posts", { p_user_id: opts.userId ?? null, p_limit: opts.limit ?? 6, p_lease_seconds: LEASE_SECONDS });
  if (error) {
    console.error("claiming queued posts failed:", error.message);
    return 0;
  }
  const claimed = (data ?? []) as Claimed[];
  if (claimed.length === 0) return 0;

  const contexts = new Map<string, Promise<Context>>();
  const smallWarmups = new Map<string, Promise<string | null>>();
  const pdfs = new Map<string, Promise<PostDocument | null>>();
  const tokens = new Map<string, Promise<string | null>>();
  const tokenFor = (uid: string) => {
    if (!tokens.has(uid)) tokens.set(uid, d.getValidSession(uid).then((s) => s?.accessToken ?? null, () => null));
    return tokens.get(uid)!;
  };

  let stopped = false; // Buffer pushed back: leave the rest for later
  const queue = [...claimed];
  const handled: Claimed[] = [];

  const work = async () => {
    for (;;) {
      if (stopped || Date.now() > deadline) return;
      const row = queue.shift();
      if (!row) return;
      handled.push(row);
      const token = await tokenFor(row.user_id);
      if (!token) {
        await finish(client, row, { status: "failed", error: "Your Buffer login expired. Log in again, then send again." });
        continue;
      }
      const key = `${row.batch_id}`;
      if (!contexts.has(key)) contexts.set(key, d.buildContext(row));
      const ctx = await contexts.get(key)!;
      if ("problem" in ctx) {
        await finish(client, row, { status: "failed", error: clip(ctx.problem, 200) });
        continue;
      }
      // A network that refuses large images gets the small JPEG slides, drawn ahead (once per send) like the others.
      const small = needsSmallImages(row.service) && ctx.smallImages ? ctx.smallImages : null;
      if (small && !d.fakeMode()) {
        if (!smallWarmups.has(key)) smallWarmups.set(key, d.warmImages(small));
        const problem = await smallWarmups.get(key)!;
        if (problem) {
          await finish(client, row, { status: "failed", error: clip(problem, 200) });
          continue;
        }
      }
      const limit = imageLimit(row.service);
      const images = (small ?? ctx.images).slice(0, limit);
      const alts = ctx.alts?.slice(0, limit);
      // LinkedIn, when asked: the whole carousel as one PDF (every slide is a page: LinkedIn's 20-image cap is for images, not documents).
      let doc: PostDocument | null = null;
      if (row.as_pdf && serviceKey(row.service) === "linkedin") {
        if (!pdfs.has(key)) pdfs.set(key, d.makePdf(row, ctx));
        doc = await pdfs.get(key)!;
      }
      const base = { channelId: row.channel_id ?? "", service: row.service, text: row.caption ?? "", images, alts, intent: row.mode };
      let out: ChannelPostOutcome = await d.createChannelPost(token, { ...base, ...(doc ? { document: doc } : {}) });
      const notes: string[] = [];
      // A plain refusal of the PDF means nothing was created, so the same post can go as images instead. An unclear outcome (a timeout, a
      // server error on a publish) is never retried: the post may exist, and a second one would be a duplicate.
      if (doc && !out.ok && !out.unknown && !out.rateLimited) {
        const why = out.error;
        out = await d.createChannelPost(token, base);
        if (out.ok) notes.push(`LinkedIn didn't take the PDF (${clip(why, 80)}), so this went as images.`);
        doc = null;
      }
      if (out.ok) {
        // Buffer saves a draft that is over its network's limit, but won't schedule or publish it: leave a note on the row (a created post has no other use for `error`).
        if (row.mode === "draft") {
          const note = limitNote(row.service, row.caption ?? "");
          if (note) notes.push(note);
        }
        if (out.altDropped) notes.push(`${serviceLabel(row.service)} didn't take the alt text, so this went without it.`);
        await finish(client, row, { status: row.mode === "draft" ? "draft" : "sending", post_id: out.postId, slides: doc ? ctx.images.length : images.length, error: notes.length ? clip(notes.join(" "), 300) : null });
        if (!d.fakeMode()) await d.logDrafts(row.user_id, [{ service: row.service, ok: true, mode: row.mode }]);
        continue;
      }
      if (out.rateLimited) {
        // Buffer says "too many requests": nothing was created, so waiting and trying again is safe. Slow down for everyone.
        stopped = true;
        if (row.attempts >= MAX_ATTEMPTS) {
          await finish(client, row, { status: "failed", error: clip(out.error, 200) });
        } else {
          const wait = BACKOFF_SECONDS[Math.min(row.attempts - 1, BACKOFF_SECONDS.length - 1)];
          await release(client, [row], new Date(Date.now() + wait * 1000));
        }
        continue;
      }
      await finish(client, row, { status: out.unknown ? "unknown" : "failed", error: clip(out.error, 200) });
      if (!d.fakeMode()) await d.logDrafts(row.user_id, [{ service: row.service, ok: false, error: out.error, mode: row.mode }]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, claimed.length) }, work));

  // Claimed but not reached (out of time, or Buffer pushed back): back in line, no attempt used.
  const rest = claimed.filter((r) => !handled.includes(r));
  if (rest.length > 0) {
    await client.from("post_history").update({ attempts: 0 }).in("id", rest.map((r) => r.id)).eq("status", "working");
    await release(client, rest);
  }
  return handled.length;
}
