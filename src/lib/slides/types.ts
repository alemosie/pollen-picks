import type { KitColors } from "@/lib/brand";

/** What a slide shows for one pick. */
export type SlideItem = {
  /** Chunk id the pick came from (custom slide layouts refer to picks by it). */
  id?: number;
  title: string;
  /** Neighborhood / group label ("Good for babies", "West"). */
  group?: string;
  /** Custom card color (hex). */
  bg?: string;
  when?: string | null;
  place?: string | null;
  blurb?: string;
  /** Optional logo image (data URI) shown above the title. */
  logo?: string;
  logoAspect?: number;
  /** Optional second logo (data URI) shown after the first, joined by "&". */
  partnerLogo?: string;
  partnerAspect?: number;
  /** Optional square image (data URI), shown in the footer corner of a single-pick slide. */
  image?: string;
};

export type Slide =
  | { kind: "cover"; /** Custom background (hex). */ bg?: string; title: string; subtitle: string; /** Square images (data URIs) shown in a row at the bottom. */ images?: string[] }
  | { kind: "picks"; /** Custom background (hex). */ bg?: string; items: SlideItem[]; group?: string; page: number; pages: number }
  | { kind: "closing"; /** Custom background (hex). */ bg?: string; title: string; line: string; more: number; /** Button text. Default "Subscribe · link in bio". */ cta?: string; /** Draw the slide on the dark background, with the link line in the accent color. */ dark?: boolean; link?: string; images?: string[] };

export type Kit = {
  name: string;
  colors: KitColors;
  /** "Created with Pollen Picks" credit at the bottom of every slide. On by default. */
  attribution?: boolean;
  /** Optional logo (data URI) shown beside the name; `logoOnAccent` is used on the cover, whose background is the accent color. */
  logo?: string;
  logoOnAccent?: string;
  /** Logo and text colors for the slide background, when it is dark (header and footer of pick slides). */
  logoOnBackground?: string;
  onBackground?: string;
  /** Color for the name in the header on a dark background (default: onBackground). */
  nameOnBackground?: string;
  /** Show "Swipe →" in the footer of every pick slide. */
  swipe?: boolean;
  /** Optional font family names (must be loaded in render.tsx). Defaults to Madimi One / DM Sans. */
  fonts?: { display: string; body: string };
  /** Name split over two lines in the cover lockup, e.g. ["Amsterdam", "Parent Project"]. */
  nameLines?: [string, string];
  /** Cover headline size in px (default 168). */
  coverTitleSize?: number;
};

export const SLIDE_W = 1080;
export const SLIDE_H = 1350; // 4:5, Instagram's tallest carousel ratio
export const MAX_IMAGES = 20; // Instagram carousel limit
