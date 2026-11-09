"use client";

import { useLayoutEffect, useState } from "react";

/** A title word with the hand-drawn wavy underline from the home page hero. The line is drawn behind the letters, so tails (g, y, p) sit on top of it. */
export function StepWord({ children }: { children: string }) {
  // Next keeps a step's page in the document (hidden) when you leave it, and shows the same DOM again when you come back via a
  // link, so the underline's one-time CSS animation can be left finished or cancelled. When the page is hidden this cleanup runs;
  // the bumped key gives the line a fresh element, so its wipe plays again the next time the page is shown.
  const [drawn, setDrawn] = useState(0);
  useLayoutEffect(() => () => setDrawn((n) => n + 1), []);
  return (
    <span className="relative isolate inline-block">
      {children}
      <svg
        key={drawn}
        aria-hidden
        viewBox="0 0 220 24"
        preserveAspectRatio="none"
        className="pp-wipe absolute -bottom-2 left-0 -z-10 h-3 w-full overflow-visible"
      >
        <path
          d="M3 14 C 40 3 70 22 110 12 S 180 4 217 13"
          fill="none"
          stroke="#f28482"
          strokeWidth="6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}
