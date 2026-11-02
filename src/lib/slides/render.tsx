import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SlideView } from "./Slide";
import { SLIDE_H, SLIDE_W, type Kit, type Slide } from "./types";

const dir = join(process.cwd(), "src", "assets", "fonts");
let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 500 | 700; style: "normal" }[]> | null = null;

function loadFonts() {
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

export async function renderSlide(slide: Slide, kit: Kit): Promise<ImageResponse> {
  const res = new ImageResponse(<SlideView slide={slide} kit={kit} />, { width: SLIDE_W, height: SLIDE_H, fonts: await loadFonts() });
  // Next's default is max-age=0, so every request re-rendered. The same slide is fetched once per channel (and by every viewer),
  // so let browsers keep it briefly and Netlify's CDN for a day. A new deploy clears the CDN cache, so template changes still show up.
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Cache-Control", "public, max-age=300");
    res.headers.set("Netlify-CDN-Cache-Control", "public, s-maxage=86400, stale-while-revalidate=86400");
  }
  return res;
}
