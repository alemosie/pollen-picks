// How long the slide images in a Buffer post stay reachable. Buffer fetches them from signed links (see ./previewSig) that stop working after
// SLIDE_LINK_DAYS. Safe for the browser: no secrets and no node imports, so the Send screen and the History page can use it too.

/** How long a signed slide link works, counted from the moment the post was sent to Buffer. */
export const SLIDE_LINK_DAYS = 14;
/** A draft that is still a draft this long after it was sent gets a heads-up. */
export const SLIDE_WARN_AFTER_DAYS = 10;

const DAY_MS = 86_400_000;

/**
 * Where a post's slide links stand. Only a draft can be in "soon" or "expired": a published post has had its images fetched, and a draft is the
 * one thing a person may leave sitting in Buffer for weeks. We don't ask Buffer whether the draft has since been published or scheduled, so this
 * goes by age alone. `now` is null before the browser clock is read, which counts as fine (so the server's HTML never depends on the time).
 */
export function slideLinkState(c: { mode: string; status: string; createdAt: string; slidesStored?: boolean }, now: number | null): "ok" | "soon" | "expired" {
  // Stored slides (see slideStore) have addresses that never run out. Only posts sent before that kept the 14-day links.
  if (c.slidesStored || now === null || c.mode !== "draft" || c.status !== "draft") return "ok";
  const age = now - new Date(c.createdAt).getTime();
  if (!Number.isFinite(age)) return "ok";
  if (age > SLIDE_LINK_DAYS * DAY_MS) return "expired";
  if (age > SLIDE_WARN_AFTER_DAYS * DAY_MS) return "soon";
  return "ok";
}
