// The default brand kit. Slides are rendered by Satori (no Tailwind), so the palette also lives here as
// plain values. Keep in sync with the @theme block in src/app/globals.css.

export type KitColors = {
  /** Slide background. */
  background: string;
  /** All text. Must have >= 4.5:1 contrast on background, card and accent. */
  text: string;
  /** Cover background, dates, rank numbers. */
  accent: string;
  /** Pick cards. */
  card: string;
  /** Small labels (neighborhood, group). */
  chip: string;
  /** Sparing highlight: tags, closing call to action. */
  highlight: string;
};

export const DEFAULT_COLORS: KitColors = {
  background: "#f7ede2", // cream
  text: "#2b3a36", // ink
  accent: "#f6bd60", // honey
  card: "#f5cac3", // blush
  chip: "#84a59d", // sage
  highlight: "#f28482", // coral
};

export const BRAND_NAME = "Pollen Picks";
export const TAGLINE = "From picks to posts: top content from Beehiiv, to Buffer, and beyond.";

// WCAG relative-luminance contrast, used to warn when a user's kit makes text unreadable.
function lum(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** True when two hex colors are the same or visually indistinguishable (a card in this color would vanish into that background). */
export function sameColor(a: string, b: string): boolean {
  const rgb = (hex: string) => [0, 2, 4].map((i) => parseInt(hex.replace("#", "").slice(i, i + 2), 16));
  const [x, y] = [rgb(a), rgb(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 24;
}
