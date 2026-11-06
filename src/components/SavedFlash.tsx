"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { SAVED_EVENT } from "@/lib/progress";

/** A brief "Saved" confirmation whenever work is written to this browser's storage. */
export function SavedFlash() {
  const [n, setN] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const on = () => {
      setN((x) => x + 1);
      setShow(true);
    };
    window.addEventListener(SAVED_EVENT, on);
    return () => window.removeEventListener(SAVED_EVENT, on);
  }, []);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(false), 1800);
    return () => clearTimeout(t);
  }, [show, n]);

  // The chip always takes its full width, just invisible until something is saved, so showing it never pushes its neighbours around.
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-3.5 py-1.5 text-sm font-bold text-cream transition-opacity duration-300 ${show ? "opacity-100" : "opacity-0"}`}>
      <span className="sr-only">{show ? "Saved!" : ""}</span>
      <span aria-hidden className="inline-flex items-center gap-1.5">
        <Check className="size-4" strokeWidth={3} /> Saved!
      </span>
    </span>
  );
}
