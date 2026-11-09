/**
 * Image carousel limits per Buffer service (lowercase). Others fall back to DEFAULT_LIMIT.
 * From Buffer's help pages "Attaching images, videos, and other media to your posts" (updated 25 Jul 2026), which also says posts over a network's limit sent
 * through the API are refused ("Instagram posts cannot have more than 10 images"), and "Using Threads with Buffer" (carousels: at most 10). Too low a number
 * silently cuts slides off the end; too high a one makes Buffer refuse the post: check this against those pages when Buffer changes them.
 */
export const IMAGE_LIMITS: Record<string, number> = {
  instagram: 10,
  facebook: 10,
  threads: 10,
  linkedin: 20,
  twitter: 4,
  bluesky: 4,
  mastodon: 4,
};
export const DEFAULT_LIMIT = 10;

/** Networks that cannot take an image carousel (need video, a board, etc.). */
export const UNSUPPORTED: Record<string, string> = {
  tiktok: "Needs video",
  youtube: "Needs video",
  pinterest: "Needs a board",
  googlebusiness: "Not supported yet",
  startpage: "Not supported yet",
};

/** Networks that refuse a large image, so the slides sent to them are small JPEGs instead of full-size PNGs (Bluesky: 1 MB, and Buffer can't shrink a file for it). */
export const SMALL_IMAGE_SERVICES = ["bluesky"];
export const needsSmallImages = (s: string) => SMALL_IMAGE_SERVICES.includes(serviceKey(s));

/** The most a single image may weigh per network, from Buffer's "Ideal image sizes and formats" page. Fake mode refuses a bigger one, as Buffer does. */
export const IMAGE_BYTE_LIMITS: Record<string, number> = {
  instagram: 8_000_000,
  facebook: 8_000_000,
  linkedin: 10_000_000,
  twitter: 5_000_000,
  threads: 8_000_000,
  bluesky: 1_000_000,
  mastodon: 8_000_000,
};

export const serviceKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
export const unsupportedReason = (s: string) => UNSUPPORTED[serviceKey(s)];
export const imageLimit = (s: string) => IMAGE_LIMITS[serviceKey(s)] ?? DEFAULT_LIMIT;

const LABELS: Record<string, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  twitter: "X",
  x: "X",
  threads: "Threads",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
  tiktok: "TikTok",
  youtube: "YouTube",
  pinterest: "Pinterest",
  googlebusiness: "Google Business",
};
/** Display name for a Buffer service ("linkedin" -> "LinkedIn"). */
export const serviceLabel = (s: string) => LABELS[serviceKey(s)] ?? s.charAt(0).toUpperCase() + s.slice(1);
