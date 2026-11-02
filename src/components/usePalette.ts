"use client";

import { useMemo, useSyncExternalStore } from "react";
import { DEFAULT_PALETTE, paletteFrom, paletteSnapshot, subscribePalette } from "@/lib/palette";

/** The saved palette, falling back to the Pollen Picks colors (also during server rendering). */
export function usePalette(): string[] {
  const raw = useSyncExternalStore(subscribePalette, paletteSnapshot, () => null);
  return useMemo(() => (raw ? paletteFrom(raw) : DEFAULT_PALETTE), [raw]);
}
