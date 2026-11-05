import type { Chunk } from "./chunks";
import { normalizeUrl } from "./url";

// Text a user highlighted on the Manual tab becomes an extra chunk of that issue. Pure helpers, safe for the browser too.

/** Chunk ids of highlights start here, well clear of the parsed chunks (0, 1, 2…), so the two never collide. */
export const CUSTOM_BASE = 1_000_000;
export const MAX_HIGHLIGHT = 2000;
export const MAX_HIGHLIGHTS_PER_ISSUE = 50;

export const isCustomId = (id: number) => id >= CUSTOM_BASE;

/** Collapses spaces, keeps single line breaks (a break can end the title), and returns null when nothing usable is left or it is too long. */
export function cleanHighlight(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw
    .replace(/\u00a0/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n\s*/g, "\n")
    .trim();
  return t.length >= 2 && t.length <= MAX_HIGHLIGHT ? t : null;
}

const flatten = (s: string) => s.replace(/\s+/g, " ").trim();
export const MAX_LINK_TEXT = 200;

/** The text of the first link in a highlight. Only kept when it really is part of the highlight and there is a link to go with it. */
export function cleanLinkText(raw: unknown, text: string, url: string | null): string | null {
  if (typeof raw !== "string" || !url) return null;
  const t = flatten(raw.replace(/\u00a0/g, " "));
  return t.length >= 1 && t.length <= MAX_LINK_TEXT && flatten(text).includes(t) ? t : null;
}

/** An http(s) link inside the highlight, or null. */
export function cleanHighlightUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (v.length > 1000 || !/^https?:\/\/[^\s]+$/i.test(v)) return null;
  try {
    new URL(v);
    return v;
  } catch {
    return null;
  }
}

const TITLE_MAX = 90;

function shorten(text: string): string {
  if (text.length <= TITLE_MAX) return text;
  const cut = text.slice(0, TITLE_MAX);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 40))}…`;
}

/** Leftover punctuation where the title was cut out (" – ", ": ", a lone comma) does not belong to the description. */
const trimJoint = (s: string) => flatten(s).replace(/^[\s\-–—:|·•,.;)\]]+/, "").replace(/[\s\-–—:|·•,;([]+$/, "");

/**
 * Splits a highlight the way a newsletter pick reads: a title, then a description.
 * - With a link: the link's text is the title. If it opens the highlight the rest is the description; if it sits mid-sentence the whole sentence is, link text included.
 * - Without one: a line break, or the first full stop, "!", "?", colon, semicolon or spaced dash, ends the title. A comma does not.
 */
export function parseHighlight(text: string, linkText?: string | null): { title: string; description: string } {
  const flat = flatten(text);
  if (linkText && flat.includes(linkText)) {
    const at = flat.indexOf(linkText);
    // The link text leads the highlight: it is the title, so it leaves the description. Mid-sentence it stays in the description, or the sentence would read "In our , we laid out…".
    const lead = flat.slice(0, at).replace(/[\s\p{P}]+/gu, "");
    const rest = trimJoint(`${flat.slice(0, at)} ${flat.slice(at + linkText.length)}`);
    return { title: shorten(linkText), description: lead ? flat : rest };
  }
  const lines = text.split("\n").map(flatten).filter(Boolean);
  if (lines.length > 1) {
    const first = lines[0];
    return first.length <= TITLE_MAX
      ? { title: first, description: lines.slice(1).join(" ") }
      : { title: shorten(first), description: flat };
  }
  const m = flat.match(/^(.{3,90}?)(\s+[–—-]\s+|[:;]\s+|[.!?]+(?:\s+|$))/);
  if (m) {
    const stop = m[2].trim();
    const title = /^[!?]/.test(stop) ? `${m[1]}${stop}` : m[1];
    return { title: title.trim(), description: flat.slice(m[0].length).trim() };
  }
  return flat.length <= TITLE_MAX ? { title: flat, description: "" } : { title: shorten(flat), description: flat };
}

export type CustomRow = { id: number; text: string; url: string | null; /** The first link's text, if the highlight had a link. */ linkText?: string | null };

/** The chunk a saved highlight stands for. The same shape the parser makes, so every later step treats it alike. */
export function customChunk(row: CustomRow): Chunk & { rank: number | null; score: number | null } {
  const { title, description } = parseHighlight(row.text, row.linkText);
  const text = flatten(row.text);
  return {
    id: CUSTOM_BASE + row.id,
    section: "Highlights",
    kind: "paragraph",
    title,
    body: description,
    text,
    when: null,
    place: null,
    blurb: description,
    url: row.url,
    key: row.url ? normalizeUrl(row.url) : null,
    rank: null,
    score: null,
  };
}
