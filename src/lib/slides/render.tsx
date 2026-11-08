import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SlideView } from "./Slide";
import { stripEmoji } from "./plan";
import { SLIDE_H, SLIDE_W, type Kit, type Slide } from "./types";

const dir = join(process.cwd(), "src", "assets", "fonts");
let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 500 | 700; style: "normal" }[]> | null = null;

export function loadFonts() {
  fonts ??= Promise.all([
    readFile(join(dir, "DMSans-400.woff")),
    readFile(join(dir, "DMSans-500.woff")),
    readFile(join(dir, "DMSans-700.woff")),
    readFile(join(dir, "MadimiOne-400.woff")),
    readFile(join(dir, "Quicksand-500.woff")),
    readFile(join(dir, "Quicksand-700.woff")),
  ]).then(([a, b, c, d, e, f]) => [
    { name: "DM Sans", data: a, weight: 400 as const, style: "normal" as const },
    { name: "DM Sans", data: b, weight: 500 as const, style: "normal" as const },
    { name: "DM Sans", data: c, weight: 700 as const, style: "normal" as const },
    { name: "Madimi One", data: d, weight: 400 as const, style: "normal" as const },
    { name: "Quicksand", data: e, weight: 500 as const, style: "normal" as const },
    { name: "Quicksand", data: f, weight: 700 as const, style: "normal" as const },
  ]);
  return fonts;
}

const stripDeep = <T,>(v: T): T =>
  typeof v === "string" ? (stripEmoji(v) as T) : Array.isArray(v) ? (v.map(stripDeep) as T) : v && typeof v === "object" ? (Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stripDeep(x)])) as T) : v;

/** Render to PNG bytes. Emoji are drawn from Twemoji images fetched at render time; if that fails, retry without emoji so the slide still exists. */
async function draw(slide: Slide, kit: Kit, withEmoji: boolean) {
  const res = new ImageResponse(<SlideView slide={slide} kit={kit} />, { width: SLIDE_W, height: SLIDE_H, fonts: await loadFonts(), ...(withEmoji ? { emoji: "twemoji" as const } : {}) });
  return res.arrayBuffer();
}

/**
 * `web` is for slides shown on screen in the design step: a smaller WebP of `web.width` pixels. Posts to Buffer never ask for it
 * and keep the full-size PNG. If sharp can't load (it is a native module), the PNG is served instead, so a preview never breaks.
 */
export async function renderSlide(slide: Slide, kit: Kit, web?: { width: number }): Promise<Response> {
  let png: ArrayBuffer;
  try {
    png = await draw(slide, kit, true);
  } catch {
    png = await draw(stripDeep(slide), kit, false);
  }
  let body: BodyInit = png;
  let type = "image/png";
  if (web) {
    try {
      const { default: sharp } = await import("sharp");
      body = new Uint8Array(await sharp(Buffer.from(png)).resize({ width: web.width }).webp({ quality: 82 }).toBuffer());
      type = "image/webp";
    } catch {
      // keep the PNG
    }
  }
  const res = new Response(body, { headers: { "Content-Type": type } });
  // Next's default is max-age=0, so every request re-rendered. The same slide is fetched once per channel (and by every viewer),
  // so let browsers keep it briefly and Netlify's CDN for a day. A new deploy clears the CDN cache, so template changes still show up.
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Cache-Control", "public, max-age=300");
    // `durable` keeps one copy in Netlify's shared cache, next to the function. Without it every edge location has its own copy: a slide drawn for one
    // location (or by our own warm-up) is a miss for Buffer's servers elsewhere, and each miss draws the whole slide again (several seconds with a photo).
    res.headers.set("Netlify-CDN-Cache-Control", "public, durable, s-maxage=86400, stale-while-revalidate=86400");
    // Netlify's CDN ignores the query string in its cache key unless told otherwise. Every slide is the same path with different
    // ?picks=&n=&spec= params, so without this the first slide rendered gets served for all of them (duplicate slides).
    res.headers.set("Netlify-Vary", "query");
  }
  return res;
}
