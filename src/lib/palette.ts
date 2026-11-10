// The user's slide palette: a handful of hex colors offered as backgrounds in the slide editor and used for the Settings preview.
// The account (the slide_styles table) holds the palette; this browser keeps a copy of it so the colors are there at once, and signed-out
// visitors (the demo) have the standard one. The chosen hex travels in the slide URL itself, so the renderer (and Buffer) never needs the palette.
import { DEFAULT_COLORS } from "./brand";
import { SAVED_EVENT } from "./progress";

const KEY = "pollen-picks:palette";
export const PALETTE_EVENT = "pollen-picks:palette-changed";
export const MIN_COLORS = 2;
export const MAX_COLORS = 8;

export const DEFAULT_PALETTE: string[] = [DEFAULT_COLORS.background, DEFAULT_COLORS.accent, DEFAULT_COLORS.card, DEFAULT_COLORS.chip, DEFAULT_COLORS.highlight, DEFAULT_COLORS.text];

/** The demo has no account to keep a palette in, so its slide addresses carry it: "f6bd60-f7ede2-..." (hex codes without the #), or undefined for the standard one. */
export const palParam = (palette: readonly string[]): string | undefined =>
  palette.length >= MIN_COLORS && palette.length <= MAX_COLORS && palette.every((c) => isHex(c)) && palette.join().toLowerCase() !== DEFAULT_PALETTE.join().toLowerCase()
    ? palette.map((c) => c.slice(1).toLowerCase()).join("-")
    : undefined;
/** The other way: a palette from an address, or null for anything that is not 2 to 8 hex codes. */
export const palFromParam = (v: string | null | undefined): string[] | null =>
  v && /^[0-9a-f]{6}(-[0-9a-f]{6}){1,7}$/i.test(v) ? v.split("-").map((h) => `#${h.toLowerCase()}`) : null;

export const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

/** "#abc", "ABCDEF", "#aabbcc" -> "#aabbcc"; anything else -> null. */
export function normalizeHex(v: string): string | null {
  const h = v.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(h)) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  return /^[0-9a-f]{6}$/.test(h) ? `#${h}` : null;
}

/** Pulls colors out of pasted text: a coolors.co URL (".../palette/f6bd60-f7ede2-..."), or hex codes separated by commas, spaces or lines. */
export function parsePalette(text: string): string[] {
  const out: string[] = [];
  const chunks = text.match(/#?[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? [];
  for (const c of chunks) {
    const h = normalizeHex(c);
    if (h && !out.includes(h)) out.push(h);
  }
  return out.slice(0, MAX_COLORS);
}

/** Raw stored string for useSyncExternalStore. */
export const paletteSnapshot = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
export function subscribePalette(cb: () => void) {
  window.addEventListener(PALETTE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(PALETTE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
export function savePalette(colors: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(colors));
    window.dispatchEvent(new Event(PALETTE_EVENT));
    window.dispatchEvent(new Event(SAVED_EVENT));
  } catch {}
}
export function resetPalette() {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(PALETTE_EVENT));
  } catch {}
}
/** Writes the palette to this browser's copy only (null = the standard palette) and tells the app. The account is not touched. */
export function storePaletteLocally(colors: string[] | null) {
  try {
    if (colors) localStorage.setItem(KEY, JSON.stringify(colors));
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(PALETTE_EVENT));
  } catch {}
}

/** Sends the palette to the account. True when it was saved. (null clears it to "never saved"; a reset should send DEFAULT_PALETTE instead.) */
export async function pushPalette(colors: string[] | null): Promise<boolean> {
  try {
    const res = colors
      ? await fetch("/api/settings/palette", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ colors }) })
      : await fetch("/api/settings/palette", { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

/** Parse a raw snapshot into a palette (default when empty or invalid). */
export function paletteFrom(raw: string | null): string[] {
  try {
    const list = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(list)) {
      const ok = list.filter((x): x is string => typeof x === "string" && isHex(x)).slice(0, MAX_COLORS);
      if (ok.length >= MIN_COLORS) return ok;
    }
  } catch {}
  return DEFAULT_PALETTE;
}
