// What the "Your brand" panel on the Design step says: the palette, logo and name the slides are drawn with, or that none of them is set yet.

import { DEFAULT_PALETTE } from "./palette";

export type BrandInfo = {
  /** The organization name saved in Settings ("" when there is none). */
  name: string;
  /** The organization beehiiv gives for the publication: what the slides use for the name when none is saved. */
  fallbackName?: string;
  /** The saved logo (a small data URI), or null. */
  logo: string | null;
};

export type BrandSummary = {
  /** True once any of the palette, the logo or the name is the user's own. The name beehiiv gives doesn't count: nothing was set up. */
  set: boolean;
  palette: string[];
  name: string;
  logo: string | null;
};

export function brandSummary(palette: string[], brand: BrandInfo | undefined): BrandSummary {
  const name = (brand?.name ?? "").replace(/\s+/g, " ").trim();
  const logo = brand?.logo ?? null;
  const ownPalette = palette.length !== DEFAULT_PALETTE.length || palette.some((c, i) => c.toLowerCase() !== DEFAULT_PALETTE[i].toLowerCase());
  return { set: ownPalette || !!name || !!logo, palette, name: name || (brand?.fallbackName ?? "").trim(), logo };
}
