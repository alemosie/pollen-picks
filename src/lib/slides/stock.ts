// Built-in pictures for the cover, for when an issue has none to offer (or none that fit): plain gray with the Pollen Picks mark in one color.
// Drawn in code as SVG, so there is nothing to host or fetch and it looks the same everywhere. A 1000x1000 square that scales to fill any
// frame ("slice") and keeps the mark in the middle, so it crops well as a banner or as a whole-slide background.
// Client-safe: no Node imports. The ids are valid picture ids (8 hex digits) that no real picture's hash is expected to use.

import type { IssueImage } from "@/lib/pollen/imageIds";
import { MARK_SVG } from "./mark";

const BG = "#d6d6d6";
const INK = "#f5f5f5";

/** The Pollen Picks dandelion mark in one color, centered, about half the height of the square. */
function mark(color: string, height = 540): string {
  const [vx, vy, vw, vh] = [157, 57, 404, 608];
  const k = height / vh;
  const inner = MARK_SVG.slice(MARK_SVG.indexOf(">") + 1, MARK_SVG.lastIndexOf("</svg>")).replaceAll("__FILL__", color);
  return `<g transform="translate(${(500 - (vw / 2) * k).toFixed(1)} ${(500 - (vh / 2) * k).toFixed(1)}) scale(${k.toFixed(4)}) translate(${-vx} ${-vy})">${inner}</g>`;
}

export const STOCK: { id: string; alt: string; svg: string }[] = [
  {
    id: "00000001",
    alt: "Plain gray with the Pollen Picks mark",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" preserveAspectRatio="xMidYMid slice"><rect width="1000" height="1000" fill="${BG}"/>${mark(INK)}</svg>`,
  },
];

const STOCK_IDS = new Set(STOCK.map((s) => s.id));
export const isStockId = (id: unknown): id is string => typeof id === "string" && STOCK_IDS.has(id);
export const stockSvg = (id: string) => STOCK.find((s) => s.id === id)?.svg;

/** The stock pictures in the shape the picture picker lists (the address is a data URI the browser can show as it is). */
export const STOCK_IMAGES: IssueImage[] = STOCK.map((s) => ({ id: s.id, src: `data:image/svg+xml;utf8,${encodeURIComponent(s.svg)}`, alt: s.alt }));
