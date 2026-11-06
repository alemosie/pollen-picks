"use client";

import { useSyncExternalStore } from "react";

// The brand's pollen: the same flat dots, in the same colours, as the splash page's dandelion.
const COLORS = ["#f6bd60", "#f6bd60", "#f28482", "#f5cac3", "#84a59d"];

type Grain = { x: number; y: number; size: number; color: string };

const NONE: Grain[] = [];
let drawn: Grain[] | null = null;
const draw = (count: number): Grain[] =>
  Array.from({ length: count }, () => ({
    x: Math.random() * 100,
    y: 99 - Math.random() ** 1.6 * 32, // gathered along the bottom of the page, thinning out higher up
    size: 5 + Math.random() * 8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
const subscribe = () => () => {};

/**
 * A few grains of pollen scattered at random along the bottom of the page, different on every visit. They are drawn only in the browser (the server renders
 * none, so the two never disagree about where they are), fade in, and stay behind the content. Decoration only. The wrapper needs `relative`.
 */
export function PollenScatter({ count = 14 }: { count?: number }) {
  const grains = useSyncExternalStore(subscribe, () => (drawn ??= draw(count)), () => NONE);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {grains.map((g, i) => (
        <span
          key={i}
          className="absolute rounded-full transition-opacity duration-1000 starting:opacity-0"
          style={{ left: `${g.x}%`, top: `${g.y}%`, width: g.size, height: g.size, background: g.color }}
        />
      ))}
    </div>
  );
}
