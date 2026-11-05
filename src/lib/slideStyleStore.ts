// Server-only: each user's slide settings (public.slide_styles, db/supabase/0011 and 0012): the slide style and the palette.

import { sessionUserId } from "./auth";
import { db } from "./db";
import { isHex, MAX_COLORS, MIN_COLORS } from "./palette";
import { DEFAULT_STYLE, type SlideStyle } from "./slides/style";

type Row = {
  top: SlideStyle["top"];
  bottom: SlideStyle["bottom"];
  font: SlideStyle["font"];
  org_name: string;
  org_logo: string | null;
  palette: unknown;
  styled: boolean;
  updated_at: string;
};

export type SlideSettings = {
  style: SlideStyle;
  /** True once the user has saved a slide style. A row that only holds a palette is not styled: slides keep the standard look. */
  styled: boolean;
  /** The user's palette, or null for the standard one. */
  palette: string[] | null;
  version: string;
};

/** A number that changes whenever the style does: it goes in the slide addresses so a changed style is never served from a cache. */
const versionOf = (updatedAt: string) => String(Date.parse(updatedAt));

/** A palette read back from the database: 2 to 8 valid colors, else null (the standard palette). */
const cleanPalette = (v: unknown): string[] | null =>
  Array.isArray(v) && v.length >= MIN_COLORS && v.length <= MAX_COLORS && v.every((c) => typeof c === "string" && isHex(c)) ? (v as string[]).map((c) => c.toLowerCase()) : null;

/** The user's saved settings, or null when they have none. A database problem also reads as null. */
export async function loadSlideStyle(userId: string): Promise<SlideSettings | null> {
  try {
    const { data, error } = await db().from("slide_styles").select("top, bottom, font, org_name, org_logo, palette, styled, updated_at").eq("user_id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    const r = data as Row | null;
    return r
      ? { style: { ...DEFAULT_STYLE, top: r.top, bottom: r.bottom, font: r.font, orgName: r.org_name, orgLogo: r.org_logo }, styled: r.styled, palette: cleanPalette(r.palette), version: versionOf(r.updated_at) }
      : null;
  } catch (e) {
    console.error("reading the slide settings failed:", (e as Error).message);
    return null;
  }
}

/** Saves the slide style (this is what makes it "styled") and returns its new version. The palette is left as it is. */
export async function saveSlideStyle(userId: string, s: SlideStyle): Promise<string> {
  const updated_at = new Date().toISOString();
  const { error } = await db()
    .from("slide_styles")
    .upsert({ user_id: userId, top: s.top, bottom: s.bottom, font: s.font, org_name: s.orgName, org_logo: s.orgLogo, styled: true, updated_at }, { onConflict: "user_id" });
  if (error) throw new Error(`Could not save the slide style: ${error.message}`);
  return versionOf(updated_at);
}

/**
 * Back to the standard header, footer and font. The organization and the palette have their own screens and are kept: the row stays
 * (as "not styled") while it holds either, and is removed when it holds neither. Returns the new version, or undefined when the row is gone.
 */
export async function resetSlideStyle(userId: string): Promise<string | undefined> {
  const cur = await loadSlideStyle(userId);
  if (cur && (cur.style.orgName || cur.style.orgLogo || cur.palette)) {
    const updated_at = new Date().toISOString();
    const { error } = await db()
      .from("slide_styles")
      .update({ top: DEFAULT_STYLE.top, bottom: DEFAULT_STYLE.bottom, font: DEFAULT_STYLE.font, styled: false, updated_at })
      .eq("user_id", userId);
    if (error) throw new Error(`Could not reset the slide style: ${error.message}`);
    return versionOf(updated_at);
  }
  const { error } = await db().from("slide_styles").delete().eq("user_id", userId);
  if (error) throw new Error(`Could not reset the slide style: ${error.message}`);
  return undefined;
}

/**
 * Saves the palette. Touches nothing else, and does not make the slide style "styled". null (the column's value before a palette is ever saved)
 * is only for clearing it by hand: a user's reset saves the standard palette itself, so every browser sees that a choice was made.
 */
export async function savePaletteFor(userId: string, palette: string[] | null): Promise<void> {
  const { data, error } = await db().from("slide_styles").update({ palette }).eq("user_id", userId).select("user_id");
  if (error) throw new Error(`Could not save the palette: ${error.message}`);
  if (!data?.length && palette) {
    const ins = await db().from("slide_styles").insert({ user_id: userId, palette, styled: false });
    if (ins.error) throw new Error(`Could not save the palette: ${ins.error.message}`);
  }
}

export { cleanPalette };

/** The signed-in visitor's style version (see `sv` in slides/options) and palette, or undefined / null when there is nothing saved or no session. */
export async function currentSlideSettings(): Promise<{ version: string | undefined; palette: string[] | null }> {
  const uid = await sessionUserId();
  if (!uid) return { version: undefined, palette: null };
  try {
    const { data } = await db().from("slide_styles").select("updated_at, palette").eq("user_id", uid).maybeSingle();
    return { version: data?.updated_at ? versionOf(data.updated_at as string) : undefined, palette: cleanPalette(data?.palette) };
  } catch {
    return { version: undefined, palette: null };
  }
}

export const currentStyleVersion = async () => (await currentSlideSettings()).version;
