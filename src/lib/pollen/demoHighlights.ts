import {
  cleanHighlight,
  cleanHighlightUrl,
  cleanLinkText,
  customChunk,
  type CustomRow,
} from "./custom";

// The public demo has no account and no database, so its highlights live in a cookie in the visitor's own browser. The server
// reads the same cookie when it builds the later steps and slide previews. A share link carries the same value as `hl=`;
// the proxy turns it into the cookie and drops it from the address, so the step URLs and slide previews stay short.
// Pure helpers, used by the browser, the server and the proxy.

export const DEMO_HL_COOKIE = "pp_demo_hl";
export const DEMO_HL_PARAM = "hl";
/** The demo's limit is on the words highlighted in total, which is what a visitor can see and reason about. */
export const MAX_DEMO_WORDS = 250;
/** The demo keeps a handful of highlights; with the word limit this always fits in the cookie (a link is dropped before text is). */
export const MAX_DEMO_HIGHLIGHTS = 5;
const MAX_ROWS = MAX_DEMO_HIGHLIGHTS;
export const wordCount = (text: string) =>
  text.split(/\s+/).filter(Boolean).length;
export const demoWords = (rows: CustomRow[]) =>
  rows.reduce((n, r) => n + wordCount(r.text), 0);
/**
 * The demo's limits as the tray words them. The word limit only concerns text the visitor highlighted on the Manual tab, so it is left out
 * until something is highlighted: "0/250 words" next to picks from the issue's own list would read as if they counted.
 */
export const meterText = (m: { count: number; maxCount: number; words: number; maxWords: number }) =>
  `${m.count}/${m.maxCount} picks${m.words > 0 ? `, ${m.words}/${m.maxWords} highlighted words` : ""}`;
/**
 * A backstop on the encoded value, which is also the longest the `hl=` part of a share link can get (about 3.6 KB: fine for
 * browsers, chat apps and servers, and inside a cookie's 4 KB). 250 ordinary words come to around 2 KB encoded, so it only
 * matters for odd text, such as very long unbroken words.
 */
export const MAX_DEMO_VALUE = 3600;

// base64url of the UTF-8 JSON: about a third bigger than the text itself, and safe to use as-is in a cookie and a URL.
const toValue = (s: string) => {
  let bin = "";
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromValue = (v: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(v.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
      c.charCodeAt(0),
    ),
  );

/** Anything unreadable or oversized gives no highlights. */
export function decodeDemoRows(raw: string | null | undefined): CustomRow[] {
  if (!raw || raw.length > MAX_DEMO_VALUE) return [];
  let data: unknown;
  try {
    data = JSON.parse(fromValue(raw));
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const rows: CustomRow[] = [];
  const seen = new Set<number>();
  for (const r of data.slice(0, MAX_ROWS)) {
    const id = Number(r?.i);
    const text = cleanHighlight(r?.t);
    if (
      !Number.isInteger(id) ||
      id < 1 ||
      id >= 1_000_000 ||
      seen.has(id) ||
      !text
    )
      continue;
    seen.add(id);
    const url = cleanHighlightUrl(r?.u);
    rows.push({ id, text, url, linkText: cleanLinkText(r?.l, text, url) });
  }
  return rows;
}

export const encodeDemoRows = (rows: CustomRow[]) =>
  toValue(JSON.stringify(rows.map((r) => ({ i: r.id, t: r.text, u: r.url, ...(r.linkText ? { l: r.linkText } : {}) }))));

export const demoHighlightChunks = (rows: CustomRow[]) => rows.map(customChunk);

// ---- Browser side ----

/** The raw cookie value, which is also what a share link carries as `hl=`. */
export function readDemoValue(): string | null {
  const hit = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${DEMO_HL_COOKIE}=`));
  return hit ? hit.slice(DEMO_HL_COOKIE.length + 1) : null;
}

/** Forget this visitor's demo highlights (a fresh start). */
export function clearDemoRows() {
  document.cookie = `${DEMO_HL_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export const readDemoRows = (): CustomRow[] => decodeDemoRows(readDemoValue());

/** false when the highlights no longer fit, so nothing was saved. */
export function writeDemoRows(rows: CustomRow[]): boolean {
  const value = encodeDemoRows(rows);
  if (value.length > MAX_DEMO_VALUE) return false;
  document.cookie = `${DEMO_HL_COOKIE}=${value}; path=/; max-age=86400; SameSite=Lax`;
  return true;
}
