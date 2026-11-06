import type { KitColors } from "@/lib/brand";
import type { Slot } from "./style";

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
  /** A picture from the issue chosen for this pick (an id from extractIssueImages). Only the id travels in the design; the renderer looks the address up in the issue. */
  photoId?: string;
  /** That picture as a data URI, filled in by the renderer's route just before drawing. Shown as a banner at the top of the card (slides with 1 or 2 picks). */
  photo?: string;
  /** Instagram handle (no "@") the pick's link points to. Drawn on the card unless the design turns tags off (planSlides drops it then). */
  tag?: string;
  /** Address the pick links to in the newsletter (http or https). Only for the "Go to source link" button on the Design step; never drawn or sent. */
  url?: string;
};

export type Slide =
  | { kind: "cover"; /** Custom background (hex). */ bg?: string; title: string; subtitle: string; /** Square images (data URIs) shown in a row at the bottom. */ images?: string[]; /** A picture from the issue (an id from extractIssueImages). Only the id travels in the design. */ photoId?: string; /** That picture as a data URI, filled in by the renderer's route just before drawing. */ photo?: string; /** "section": a block between the logo and the text. "background": the whole slide, under a darkening layer. */ photoMode?: "section" | "background"; /** A faded dandelion in the top right corner. */ puff?: boolean }
  | { kind: "picks"; /** Custom background (hex). */ bg?: string; items: SlideItem[]; group?: string; page: number; pages: number; /** The carousel's own title (the cover's), for the "Carousel title" corner option. */ carouselTitle?: string }
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
  /** What goes in the left corner of the header and the footer of pick slides (Settings > Slide style). Without it the slides keep their built-in header and footer. */
  slots?: { top: Slot; bottom: Slot };
  /** The facts those slots can show. A logo is a data URI; its aspect is width / height. */
  identity?: {
    publication: { name: string; logo?: string; logoAspect?: number };
    organization: { name: string; logo?: string; logoAspect?: number };
    title: string;
    date: string;
    /** The carousel's own title (the cover's). Filled in per slide by the renderer. */
    carouselTitle?: string;
  };
};

export const SLIDE_W = 1080;
export const SLIDE_H = 1350; // 4:5, Instagram's tallest carousel ratio
/** The most picks on one slide that still have room for a picture banner on their card. */
export const PHOTO_MAX_PICKS = 2;
/** How many picture links one user may keep (see lib/userPhotoLinks.ts, which enforces it). Only addresses are kept, so this is generous. */
export const MAX_PHOTO_LINKS = 50;
export const MAX_IMAGES = 20; // Instagram carousel limit
