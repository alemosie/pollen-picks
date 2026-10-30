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
  ]).then(([a, b, c, d]) => [
    { name: "DM Sans", data: a, weight: 400 as const, style: "normal" as const },
    { name: "DM Sans", data: b, weight: 500 as const, style: "normal" as const },
    { name: "DM Sans", data: c, weight: 700 as const, style: "normal" as const },
    { name: "Madimi One", data: d, weight: 400 as const, style: "normal" as const },
  ]);
  return fonts;
}

export async function renderSlide(slide: Slide, kit: Kit): Promise<ImageResponse> {
  return new ImageResponse(<SlideView slide={slide} kit={kit} />, { width: SLIDE_W, height: SLIDE_H, fonts: await loadFonts() });
}
