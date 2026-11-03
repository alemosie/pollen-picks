import {
  cleanHighlight,
  cleanHighlightUrl,
  customChunk,
  type CustomRow,
} from "./custom";

// The public demo has no account and no database, so its highlights live in a cookie in the visitor's own browser. The server
// reads the same cookie when it builds the later steps and slide previews. Pure helpers, used by both sides.

export const DEMO_HL_COOKIE = "pp_demo_hl";
export const MAX_DEMO_HIGHLIGHTS = 8;
/** Browsers keep a cookie up to about 4 KB; stay clear of that. */
const MAX_COOKIE = 3500;

/** Accepts the raw cookie value, encoded or already decoded. Anything unreadable gives no highlights. */
export function decodeDemoRows(raw: string | null | undefined): CustomRow[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    try {
      data = JSON.parse(decodeURIComponent(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  const rows: CustomRow[] = [];
  for (const r of data.slice(0, MAX_DEMO_HIGHLIGHTS)) {
    const id = Number(r?.i);
    const text = cleanHighlight(r?.t);
    if (!Number.isInteger(id) || id < 1 || !text) continue;
    rows.push({ id, text, url: cleanHighlightUrl(r?.u) });
  }
  return rows;
}

export const encodeDemoRows = (rows: CustomRow[]) =>
  encodeURIComponent(
    JSON.stringify(rows.map((r) => ({ i: r.id, t: r.text, u: r.url }))),
  );

export const demoHighlightChunks = (rows: CustomRow[]) => rows.map(customChunk);

// ---- Browser side ----

export function readDemoRows(): CustomRow[] {
  const hit = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${DEMO_HL_COOKIE}=`));
  return decodeDemoRows(hit?.slice(DEMO_HL_COOKIE.length + 1));
}

/** false when the highlights no longer fit in a cookie, so nothing was saved. */
export function writeDemoRows(rows: CustomRow[]): boolean {
  const value = encodeDemoRows(rows);
  if (value.length > MAX_COOKIE) return false;
  document.cookie = `${DEMO_HL_COOKIE}=${value}; path=/; max-age=86400; SameSite=Lax`;
  return true;
}
