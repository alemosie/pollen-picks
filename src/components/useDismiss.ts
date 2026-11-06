"use client";

import { useEffect, type RefObject } from "react";

/**
 * Close a tap-to-open bubble when the next tap lands anywhere outside it, or on Escape. iOS Safari doesn't focus a button when it is
 * tapped, so a blur handler alone would leave the bubble open.
 */
export function useDismiss(open: boolean, ref: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open, ref, close]);
}
