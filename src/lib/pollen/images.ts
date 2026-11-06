import { HTMLElement, parse } from "node-html-parser";
import { imageId, type IssueImage } from "./imageIds";

export { imageId, imageKey, isImageId, type IssueImage } from "./imageIds";

export const MAX_ISSUE_IMAGES = 40;
/** Anything declared smaller than this on either side is an avatar, icon or spacer, not a picture. */
const MIN_SIDE = 80;
// GIFs are skipped too: in a newsletter they are animations (the header or a sign-off), which a still slide can't show.
const JUNK_URL = /\/(open|pixel|track|beacon)\b|emoji|spacer|profile_picture|\/avatars?\/|\.svg(\?|$)|\.gif(\?|$)|\/logo\b/i;

const side = (v: string | undefined) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * The pictures in an issue's HTML, in reading order, without duplicates. Skips tracking pixels, emoji, icons, logos, author avatars
 * and anything declared tiny. `html` is the issue as beehiiv renders it; relative or non-https addresses are ignored.
 */
export function extractIssueImages(html: string, opts: { /** The issue's address, so relative picture addresses resolve. */ base?: string; /** beehiiv's preview image for the issue. */ thumbnail?: string } = {}): IssueImage[] {
  const root = parse(html);
  const thumb = absolute(opts.thumbnail ?? "", opts.base);
  const first: IssueImage[] = thumb && !JUNK_URL.test(thumb) ? [{ id: imageId(thumb), src: thumb, alt: "The issue's preview image", preview: true }] : [];
  return collect(root, opts.base, MAX_ISSUE_IMAGES, [...first, ...previewImages(root, opts.base, "The issue's preview image")]);
}

/** The page's own preview images (og:image, twitter:image), as pictures. */
function previewImages(root: HTMLElement, base: string | undefined, alt: string): IssueImage[] {
  const meta = (n: string) => root.querySelector(`meta[property="${n}"], meta[name="${n}"]`)?.getAttribute("content");
  return ["og:image:secure_url", "og:image", "twitter:image"]
    .map((n) => absolute(meta(n) ?? "", base))
    .filter((src): src is string => !!src && !JUNK_URL.test(src))
    .map((src): IssueImage => ({ id: imageId(src), src, alt, preview: true }));
}

/** An address as an absolute https one: relative and protocol-relative ones are resolved against `base`; anything else (http, data:) is null. */
function absolute(raw: string, base?: string): string | null {
  const v = raw.trim().replace(/&amp;/g, "&");
  if (!v) return null;
  try {
    const u = new URL(v, base);
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

function collect(root: HTMLElement, base: string | undefined, max: number, first: IssueImage[] = []): IssueImage[] {
  const out: IssueImage[] = [];
  const seen = new Set<string>();
  const add = (img: IssueImage) => {
    if (out.length < max && !seen.has(img.id)) {
      seen.add(img.id);
      out.push(img);
    }
  };
  first.forEach(add);
  for (const img of root.querySelectorAll("img")) {
    // Lazy-loaded pictures keep the real address in data-src.
    const src = absolute(img.getAttribute("src") || img.getAttribute("data-src") || "", base);
    if (!src || JUNK_URL.test(src)) continue;
    const width = side(img.getAttribute("width"));
    const height = side(img.getAttribute("height"));
    if ((width !== undefined && width < MIN_SIDE) || (height !== undefined && height < MIN_SIDE)) continue;
    add({ id: imageId(src), src, alt: (img.getAttribute("alt") ?? "").replace(/\s+/g, " ").trim().slice(0, 140), width, height });
  }
  return out;
}

export const MAX_LINK_IMAGES = 12;

/** The site a page belongs to: its og:site_name, else its host without "www." ("Luma", "venue.example.org"). */
export function pageSiteName(html: string, pageUrl: string): string {
  const named = parse(html).querySelector('meta[property="og:site_name"], meta[name="application-name"]')?.getAttribute("content")?.replace(/\s+/g, " ").trim();
  if (named) return named.slice(0, 60);
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Every usable picture on a web page (an event page, a venue's site, a post): the page's own preview image (og:image / twitter:image)
 * first, then the pictures in the page, with the same filtering as an issue's. `pageUrl` is the page's final address, so relative
 * addresses resolve.
 */
export function extractPageImages(html: string, pageUrl: string): IssueImage[] {
  const root = parse(html);
  return collect(root, pageUrl, MAX_LINK_IMAGES, previewImages(root, pageUrl, "Preview image of the page"));
}
