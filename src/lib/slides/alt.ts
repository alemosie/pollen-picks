// Alt text for the slide images, so a screen reader says what a slide shows. The slides are pictures of text, so the alt text is that text: the
// titles (and dates) of the picks on a slide, or the cover's and the closing slide's own words. Nothing is rewritten or generated: it is the
// text that was drawn.

import { stripEmoji } from "./plan";
import type { Slide } from "./types";

/**
 * The longest alt text sent with a slide. Buffer recommends under 200 characters on every network, and the strictest limit it lists for the networks
 * we send to is LinkedIn's 300 (Instagram, X, Facebook, Threads and Mastodon allow 1,000, Pinterest 500, Bluesky 2,000). 200 follows its advice and
 * leaves room under every one of those limits.
 */
export const ALT_MAX = 200;

const squash = (s: string) => stripEmoji(s).replace(/\s+/g, " ").trim();

/** Cuts at a word where it can, and says so with an ellipsis. */
export function clipAlt(text: string, max = ALT_MAX): string {
  const t = squash(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.\-–—]+$/, "")}…`;
}

/** What one slide says, in a line. */
export function altTextFor(slide: Slide): string {
  if (slide.kind === "cover") return clipAlt([slide.title, slide.subtitle].filter(Boolean).join(". "));
  if (slide.kind === "closing") return clipAlt([slide.title, slide.line].filter(Boolean).join(". "));
  // A pick with no title says its description instead, so it still has words for a screen reader.
  const parts = slide.items.map((it) => [squash(it.title) || squash(it.blurb ?? ""), it.when ? squash(it.when) : ""].filter(Boolean).join(", ")).filter(Boolean);
  return clipAlt(parts.join("; "));
}

/** The alt text of every slide, in order. */
export const altTexts = (slides: Slide[]): string[] => slides.map(altTextFor);
