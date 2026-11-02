/** Image carousel limits per Buffer service (lowercase). Others fall back to DEFAULT_LIMIT. */
export const IMAGE_LIMITS: Record<string, number> = {
  instagram: 20,
  facebook: 10,
  threads: 20,
  linkedin: 9,
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
