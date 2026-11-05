// The slide style a user sets in Settings > Slide style: what goes in the header's and footer's left corner, and the font.
// Shared by the Settings screen, the server that stores it and the slide renderer, so it holds no server-only code.

export const SLOTS = ["publication", "organization", "title", "date", "none"] as const;
export type Slot = (typeof SLOTS)[number];
export const SLOT_LABEL: Record<Slot, string> = {
  publication: "Publication name + logo",
  organization: "Organization name + logo",
  title: "Issue title",
  date: "Issue date",
  none: "Nothing",
};

/** The three fonts the renderer has loaded (src/assets/fonts). The choice is the headline font; the text under it pairs with it. */
export const FONTS = ["madimi", "dmsans", "quicksand"] as const;
export type SlideFont = (typeof FONTS)[number];
export const FONT_LABEL: Record<SlideFont, string> = { madimi: "Default", dmsans: "DM Sans", quicksand: "Quicksand" };
export const FONT_NOTE: Record<SlideFont, string> = {
  madimi: "Madimi One headers with DM Sans text.",
  dmsans: "Clean and modern, one family throughout.",
  quicksand: "Soft and rounded, one family throughout.",
};

/** Family names for the renderer's `kit.fonts`; undefined keeps the standard pairing (Madimi One + DM Sans). */
export const fontPair = (f: SlideFont): { display: string; body: string } | undefined =>
  f === "dmsans" ? { display: "DM Sans", body: "DM Sans" } : f === "quicksand" ? { display: "Quicksand", body: "Quicksand" } : undefined;

export type SlideStyle = { top: Slot; bottom: Slot; font: SlideFont; orgName: string; /** A small PNG or JPEG as a data URI. */ orgLogo: string | null };

export const DEFAULT_STYLE: SlideStyle = { top: "publication", bottom: "publication", font: "madimi", orgName: "", orgLogo: null };

export const MAX_ORG_NAME = 80;
export const MAX_LOGO_CHARS = 250_000;
export const LOGO_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : null);

/**
 * A style from untrusted input (the save request), applied over `base` (what is saved now): a field left out keeps its saved value,
 * so the Slide style screen and the Organization screen can each save their own fields without touching the other's.
 * `orgLogo` null removes the logo. Returns null when anything given is not an allowed value.
 */
export function cleanStyle(raw: unknown, base: SlideStyle): SlideStyle | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const top = r.top === undefined ? base.top : oneOf(SLOTS, r.top);
  const bottom = r.bottom === undefined ? base.bottom : oneOf(SLOTS, r.bottom);
  const font = r.font === undefined ? base.font : oneOf(FONTS, r.font);
  if (!top || !bottom || !font) return null;
  if (r.orgName !== undefined && typeof r.orgName !== "string") return null;
  const orgName = typeof r.orgName === "string" ? r.orgName.replace(/\s+/g, " ").trim().slice(0, MAX_ORG_NAME) : base.orgName;
  let orgLogo = base.orgLogo;
  if (r.orgLogo === null) orgLogo = null;
  else if (r.orgLogo !== undefined) {
    if (typeof r.orgLogo !== "string" || r.orgLogo.length > MAX_LOGO_CHARS || !LOGO_RE.test(r.orgLogo)) return null;
    orgLogo = r.orgLogo;
  }
  return { top, bottom, font, orgName, orgLogo };
}

/** "5 Nov 2026" from an ISO date or timestamp, or "" when it isn't one. */
export function issueDate(iso: string | null | undefined): string {
  const d = new Date(iso ?? "");
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}
