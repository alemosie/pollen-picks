"use client";

import { useEffect, useRef } from "react";

// The brand's pollen: the same flat dots, in the same colours, as the splash page's dandelion (see path/PollenBurst).
const COLORS = ["#f6bd60", "#f6bd60", "#f28482", "#f5cac3", "#84a59d"];
// Resting pollen, kept to the panel's top-right corner so nothing sits behind the field or its text. [right %, top px, size px]
const REST: [number, number, number][] = [
  [4, 14, 11],
  [9, 32, 6],
  [14, 8, 8],
  [20, 28, 5],
  [3, 40, 7],
  [27, 12, 6],
  [-1, 30, 9],
];

/**
 * Decoration for the paste panel: a few grains of pollen resting in its top-right corner. When `found` changes to a new post, the grains
 * do a small happy bob in place, each a beat after the one before. Absolutely positioned: the panel needs
 * `relative`. Still under reduced motion.
 */
export function PollenDots({ found }: { found: string | null }) {
  const dots = useRef<(HTMLSpanElement | null)[]>([]);
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!found || found === last.current) return;
    const t = setTimeout(() => {
      last.current = found; // set inside the timer: React's development double-run of effects clears the first one
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const els = dots.current.filter((d): d is HTMLSpanElement => d !== null);
      els.forEach((el, i) => {
        // A small happy bob: each grain hops up and sways, then a smaller hop, and rests where it started. Smooth, not shaky.
        const sway = (i % 2 ? 1 : -1) * 2;
        const hop = 4 + (i % 3);
        el.animate(
          [
            { transform: "translate(0,0) scale(1)", offset: 0 },
            { transform: `translate(${sway}px,${-hop}px) scale(1.2)`, offset: 0.25 },
            { transform: "translate(0,0) scale(0.95)", offset: 0.5 },
            { transform: `translate(${-sway * 0.6}px,${-hop * 0.5}px) scale(1.1)`, offset: 0.75 },
            { transform: "translate(0,0) scale(1)", offset: 1 },
          ],
          { duration: 1500, delay: i * 120, easing: "ease-in-out", fill: "backwards" },
        );
      });
    }, 0);
    return () => clearTimeout(t);
  }, [found]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {REST.map(([r, y, s], i) => (
        <span
          key={i}
          ref={(el) => {
            dots.current[i] = el;
          }}
          className="absolute rounded-full"
          style={{ right: `${r}%`, top: y, width: s, height: s, background: COLORS[i % COLORS.length] }}
        />
      ))}
    </div>
  );
}
