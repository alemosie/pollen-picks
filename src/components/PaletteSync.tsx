"use client";

import { useEffect } from "react";
import { DEFAULT_PALETTE, paletteFrom, paletteSnapshot, pushPalette, storePaletteLocally } from "@/lib/palette";

const same = (a: string[], b: string[]) => a.length === b.length && a.every((c, i) => c.toLowerCase() === b[i].toLowerCase());

/**
 * Keeps this browser's copy of the palette in step with the account's (`palette`, from the server; null = none saved there).
 * The account wins, a saved reset included (it is stored as the standard palette). Only when the account has never saved one, and this
 * browser has a custom one (made before palettes were saved to the account), is that one sent up, once. Renders nothing; put it on signed-in pages that use the palette.
 */
export function PaletteSync({ palette }: { palette: string[] | null }) {
  useEffect(() => {
    const local = paletteFrom(paletteSnapshot());
    if (palette) {
      if (!same(local, palette)) storePaletteLocally(palette);
    } else if (!same(local, DEFAULT_PALETTE)) {
      void pushPalette(local);
    }
  }, [palette]);
  return null;
}
