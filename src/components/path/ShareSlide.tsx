"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";

const SPARKS = [
  [-46, -38], [0, -54], [46, -38], [58, 4], [40, 44], [-40, 44], [-58, 4], [0, 54],
] as const;
const COLORS = ["#f6bd60", "#f28482", "#84a59d"];

/** A decorative share button for the demo slide, bottom right of the card: each tap puffs out pollen. Nothing is actually sent. */
export function ShareSlide() {
  const [taps, setTaps] = useState(0);
  return (
    <span className="absolute bottom-3 right-3">
      <button
        type="button"
        aria-label="Share this slide"
        onClick={() => setTaps((t) => t + 1)}
        className="relative z-10 grid size-10 place-items-center rounded-full bg-ink text-cream shadow-md transition hover:-translate-y-0.5 hover:bg-ink-deep active:scale-95"
      >
        <Share2 className="size-[1.15rem]" aria-hidden />
      </button>
      {taps > 0 && (
        <span key={taps} aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          {SPARKS.map(([x, y], i) => (
            <span
              key={i}
              className="pp-spark absolute size-2.5 rounded-full"
              style={{ "--x": `${x}px`, "--y": `${y}px`, background: COLORS[i % 3] } as React.CSSProperties}
            />
          ))}
        </span>
      )}
    </span>
  );
}
