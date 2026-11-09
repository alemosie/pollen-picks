// Server-only: the final slide images of a send, kept in the public "slides" bucket (db/supabase/0026_slide_storage.sql). Buffer is given these
// addresses instead of links that draw the slide again on every request, so a post's images don't depend on anything staying the same afterwards.

import { createHash } from "node:crypto";
import { db } from "./db";

export const SLIDE_BUCKET = "slides";
const prefix = (userId: string) => `u/${userId}`;
/** A post that is over (published, deleted in Buffer or failed) keeps its stored slides this long, then loses them (see pruneStoredSlides). */
export const SLIDE_RETENTION_DAYS = 30;
/** The statuses (Buffer's, or ours) after which a post no longer needs its images. A draft, a scheduled post and anything still on its way keep theirs. */
export const OVER_STATUSES = ["sent", "removed", "failed", "error"];

export type StoredSlide = { bytes: Buffer; type: "image/png" | "image/jpeg" };

/** The public address of a stored file. */
export const slidePublicUrl = (path: string): string => db().storage.from(SLIDE_BUCKET).getPublicUrl(path).data.publicUrl;

/** Uploads one slide. The name is the image's hash, so storing the same slide twice (a retry, a second channel) is one file. Returns its path. */
export async function storeSlide(userId: string, s: StoredSlide): Promise<string> {
  const hash = createHash("sha256").update(s.bytes).digest("hex").slice(0, 40);
  const path = `${prefix(userId)}/${hash}.${s.type === "image/jpeg" ? "jpg" : "png"}`;
  const { error } = await db().storage.from(SLIDE_BUCKET).upload(path, s.bytes, { contentType: s.type, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`Could not store a slide: ${error.message}`);
  return path;
}

/** Removes files by path. Missing files are fine. */
export async function removeSlides(paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await db().storage.from(SLIDE_BUCKET).remove(paths.slice(i, i + 100));
    if (error) throw new Error(`Could not remove stored slides: ${error.message}`);
  }
}

/** Every stored slide of one account (for deleting the account). */
export async function removeAllSlidesOf(userId: string): Promise<void> {
  const dir = prefix(userId);
  for (;;) {
    const { data, error } = await db().storage.from(SLIDE_BUCKET).list(dir, { limit: 100 });
    if (error) throw new Error(`Could not list stored slides: ${error.message}`);
    const names = (data ?? []).filter((f) => f.name && f.id).map((f) => `${dir}/${f.name}`);
    if (names.length === 0) return;
    await removeSlides(names);
  }
}

/**
 * Drops the stored slides of this account's posts that are over (see OVER_STATUSES) for more than SLIDE_RETENTION_DAYS, and forgets their paths.
 * A draft or scheduled post keeps its slides for as long as it stays one: Buffer fetches them again when it publishes, and the app learns that a draft
 * was published or deleted when History asks Buffer (see refreshHistory), so a draft nobody opens History for is simply kept. The 30 days count from the
 * last time Buffer was asked about the post (when it became final), or from sending when it never was. A file another post still lists (the same slide
 * sent twice is one file) is left alone. Best effort: called from a place that already runs for the account.
 */
export async function pruneStoredSlides(userId: string, now = Date.now()): Promise<void> {
  const { data, error } = await db().from("post_history").select("id, status, created_at, checked_at, slide_paths, slide_paths_small").eq("user_id", userId).not("slide_paths", "is", null);
  if (error || !data?.length) return;
  type R = { id: number; status: string; created_at: string; checked_at: string | null; slide_paths: string[] | null; slide_paths_small: string[] | null };
  const cutoff = now - SLIDE_RETENTION_DAYS * 86_400_000;
  const paths = (r: R) => [...(r.slide_paths ?? []), ...(r.slide_paths_small ?? [])];
  const over = (data as R[]).filter((r) => OVER_STATUSES.includes(r.status) && new Date(r.checked_at ?? r.created_at).getTime() < cutoff);
  if (over.length === 0) return;
  const stillUsed = new Set((data as R[]).filter((r) => !over.includes(r)).flatMap(paths));
  const drop = [...new Set(over.flatMap(paths))].filter((p) => !stillUsed.has(p));
  if (drop.length) await removeSlides(drop);
  await db().from("post_history").update({ slide_paths: null, slide_paths_small: null }).in("id", over.map((r) => r.id));
}

/**
 * The public addresses of the slides of this account's latest send, for feedback that says yes to "OK to share?". Read from the account's own send
 * history here on the server, never from what the browser sends. Empty when there is none (or the columns don't exist yet).
 */
export async function latestStoredSlideUrls(userId: string): Promise<string[]> {
  const { data, error } = await db().from("post_history").select("slide_paths").eq("user_id", userId).not("slide_paths", "is", null).order("created_at", { ascending: false }).limit(1);
  if (error || !data?.length) return [];
  return ((data[0] as { slide_paths: string[] | null }).slide_paths ?? []).slice(0, 10).map(slidePublicUrl);
}
