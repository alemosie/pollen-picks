"use client";

import { useLayoutEffect, useRef } from "react";

// Shown while a step loads. A gust of pollen blows in from the left, loops once and drifts out to the right, then comes round again.
// Pure SVG (SMIL), so it works as a Suspense fallback. It only appears if a page takes a second or more, so quick loads never flash it.

const GUST = "M-60 150 C 120 150 230 140 310 112 C 400 80 470 30 420 10 C 360 -12 290 40 330 90 C 370 135 480 145 580 126 C 680 108 770 84 860 96";
const SECS = 6.5; // one pass of the gust
const COLORS = ["var(--color-honey)", "var(--color-coral)", "var(--color-sage)", "var(--color-honey)", "var(--color-ink)"];
const SIZES = [5, 3, 4, 3, 4];

// Each grain rides the same path, started at a different point in the loop and nudged a little off the line so the gust looks loose.
const COUNT = 14;
const GRAINS = Array.from({ length: COUNT }, (_, i) => ({
  dx: ((i * 37) % 12) - 6,
  dy: ((i * 53) % 14) - 7,
  r: SIZES[i % SIZES.length],
  color: COLORS[i % COLORS.length],
  begin: -((i * SECS) / COUNT) * 0.5,
}));

export function FlowLoader({ label = "One moment…", instant = false }: { label?: string; /** Show at once, with no fade. By default it waits a moment, so quick loads never flash it. */ instant?: boolean }) {
  const svg = useRef<SVGSVGElement>(null);
  // A step can show this twice in a row (Design: the page's Suspense fallback, then the loader that waits for the slide previews). A new SVG
  // would start its loop from the beginning, so the pollen would jump back. Setting every instance to the same point of the loop,
  // taken from the clock, makes the second one carry on exactly where the first left off.
  useLayoutEffect(() => {
    try {
      svg.current?.setCurrentTime((Date.now() % (SECS * 1000)) / 1000);
    } catch {}
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pp-flow-stage fixed inset-0 z-50 grid place-items-center bg-page"
      style={instant ? { animation: "none" } : undefined}
    >
      <div className="grid justify-items-center gap-6">
        <svg
          ref={svg}
          viewBox="0 -30 800 230"
          width="800"
          height="230"
          aria-hidden
          className="pp-gust h-auto w-[min(90vw,52rem)] overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_15%,#000_85%,transparent)]"
        >
          <defs>
            <path id="pp-gust-path" d={GUST} />
          </defs>
          {GRAINS.map((g, i) => (
            <g key={i} transform={`translate(${g.dx} ${g.dy})`}>
              <circle r={g.r} fill={g.color} opacity="0">
                <animateMotion dur={`${SECS}s`} begin={`${g.begin}s`} repeatCount="indefinite" calcMode="spline" keyTimes="0;1" keyPoints="0;1" keySplines=".25 .1 .75 .9">
                  <mpath href="#pp-gust-path" />
                </animateMotion>
                <animate attributeName="opacity" dur={`${SECS}s`} begin={`${g.begin}s`} repeatCount="indefinite" values="0;.9;.9;.9;0" keyTimes="0;.2;.5;.8;1" />
              </circle>
            </g>
          ))}
        </svg>
        <p className="m-0 font-display text-2xl">{label}</p>
      </div>
    </div>
  );
}
