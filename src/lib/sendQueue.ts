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
import type { SupabaseClient } from "@supabase/supabase-js";
import { limitNote } from "./caption";
import { imageLimit, needsSmallImages, unsupportedReason } from "./channels";
import { siteOrigin } from "./buffer";
import { createChannelPost, fakeMode } from "./bufferPost";
import { getValidSession } from "./connections";
import { db } from "./db";
import { logDrafts } from "./draftLog";
import { knownForPicks } from "./instagramHandles";
import { signPreview } from "./previewSig";
import { loadAppIssue } from "./sources";
import { planSlides } from "./slides/plan";
import { slideItemsFor } from "./slides/items";
import { parseTemplateFrom, templateParams } from "./slides/options";
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
      : { ...base(c), status: "queued", source: r.source.slice(0, 200), picks: r.picks, template: r.template.slice(0, 4000), caption: c.caption.slice(0, 10_000) };
  });
  const { error } = await client.from("post_history").insert(rows);
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
};

/** What every channel of one send shares: the slide image addresses (signed for this user), or why they can't be made. */
/** `smallImages` is the same slides as small JPEGs, for the networks that refuse large images (see needsSmallImages); drawn only when a channel needs them. */
export type Context = { images: string[]; smallImages?: string[] } | { problem: string };

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

async function buildContext(row: Claimed): Promise<Context> {
  const source = row.source ?? "";
  const issue = await loadAppIssue(source, row.user_id);
  if (!issue) return { problem: "Couldn't load this issue. Log in again from the Source step and send again." };
  const picks = row.picks ?? [];
  if (picks.length === 0) return { problem: "No picks." };
  const tpl = parseTemplateFrom(new URLSearchParams(row.template ?? ""));
  const slides = planSlides(slideItemsFor(issue.chunks, picks, await knownForPicks(issue.chunks, picks)), { newsletter: issue.newsletter, ...tpl });
  const base = (process.env.PUBLIC_BASE_URL ?? siteOrigin()).replace(/\/$/, "");
  if (!fakeMode() && /localhost|127\.0\.0\.1/.test(base)) {
    return { problem: `Slide images are served from ${base}, which Buffer can't reach. Use the deployed site (or set PUBLIC_BASE_URL to a tunnel).` };
  }
  // Buffer fetches the images with no login, so the URLs are signed for this user, issue, picks and template (see previewSig).
  const signed = signPreview(new URLSearchParams([...templateParams(tpl).entries(), ["picks", picks.join(",")], ["mode", source]]), row.user_id).toString();
  const images = slides.map((_, i) => `${base}/api/slide/preview?${signed}&n=${i}`);
  if (!fakeMode()) {
    // Draw each slide once ourselves first: it warms the CDN, so Buffer's own request is quick, and a slide that can't be drawn stops the send
    // here with a clear reason instead of leaving a half-published post in Buffer.
    const problem = await warm(images);
    if (problem) return { problem };
  }
  // The small JPEG set has its own signature (it names fmt=jpg). It is only drawn when a channel that needs it comes up in the worker.
  const signedSmall = signPreview(new URLSearchParams([...templateParams(tpl).entries(), ["picks", picks.join(",")], ["mode", source], ["fmt", "jpg"]]), row.user_id).toString();
  const smallImages = slides.map((_, i) => `${base}/api/slide/preview?${signedSmall}&n=${i}`);
  return { images, smallImages };
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
  createChannelPost: typeof createChannelPost;
  logDrafts: typeof logDrafts;
  fakeMode: () => boolean;
};
const realDeps = (): QueueDeps => ({ db, getValidSession, buildContext, warmImages: warm, createChannelPost, logDrafts, fakeMode });

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
      const images = (small ?? ctx.images).slice(0, imageLimit(row.service));
      const out = await d.createChannelPost(token, {
        channelId: row.channel_id ?? "",
        service: row.service,
        text: row.caption ?? "",
        images,
        intent: row.mode,
      });
      if (out.ok) {
        // Buffer saves a draft that is over its network's limit, but won't schedule or publish it: leave a note on the row (a created post has no other use for `error`).
        const note = row.mode === "draft" ? limitNote(row.service, row.caption ?? "") : null;
        await finish(client, row, { status: row.mode === "draft" ? "draft" : "sending", post_id: out.postId, slides: images.length, error: note });
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
