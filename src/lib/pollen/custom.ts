import type { Chunk } from "./chunks";
import { normalizeUrl } from "./url";

// Text a user highlighted on the Manual tab becomes an extra chunk of that issue. Pure helpers, safe for the browser too.

/** Chunk ids of highlights start here, well clear of the parsed chunks (0, 1, 2…), so the two never collide. */
export const CUSTOM_BASE = 1_000_000;
export const MAX_HIGHLIGHT = 2000;
export const MAX_HIGHLIGHTS_PER_ISSUE = 50;

export const isCustomId = (id: number) => id >= CUSTOM_BASE;

/** Collapses whitespace, and returns null when nothing usable is left or it is too long. */
export function cleanHighlight(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.replace(/ /g, " ").replace(/\s+/g, " ").trim();
  return t.length >= 2 && t.length <= MAX_HIGHLIGHT ? t : null;
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

/** A short title: the first sentence if it is short enough, else the first words. */
function titleOf(text: string): string {
  const sentence = text.match(/^.{8,90}?[.!?](?=\s|$)/)?.[0];
  if (sentence) return sentence;
  if (text.length <= 90) return text;
  const cut = text.slice(0, 90);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 40))}…`;
}

export type CustomRow = { id: number; text: string; url: string | null };

/** The chunk a saved highlight stands for. The same shape the parser makes, so every later step treats it alike. */
export function customChunk(row: CustomRow): Chunk & { rank: number | null; score: number | null } {
  return {
    id: CUSTOM_BASE + row.id,
    section: "Highlights",
    kind: "paragraph",
    title: titleOf(row.text),
    body: "",
    text: row.text,
    when: null,
    place: null,
    blurb: row.text,
    url: row.url,
    key: row.url ? normalizeUrl(row.url) : null,
    rank: null,
    score: null,
  };
}
