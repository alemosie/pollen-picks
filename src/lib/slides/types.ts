import type { KitColors } from "@/lib/brand";

/** What a slide shows for one pick. */
export type SlideItem = {
  title: string;
  /** Neighborhood / group label ("Good for babies", "West"). */
  group?: string;
  when?: string | null;
  place?: string | null;
  blurb?: string;
};

export type Slide =
  | { kind: "cover"; title: string; subtitle: string }
  | { kind: "picks"; items: SlideItem[]; group?: string; page: number; pages: number }
  | { kind: "closing"; title: string; line: string; more: number };

export type Kit = {
  name: string;
  colors: KitColors;
  /** "Created with Pollen Picks" credit at the bottom of every slide. On by default. */
  attribution?: boolean;
};

export const SLIDE_W = 1080;
export const SLIDE_H = 1350; // 4:5, Instagram's tallest carousel ratio
export const MAX_IMAGES = 20; // Instagram carousel limit
