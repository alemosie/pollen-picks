"use client";

import { useEffect, useRef, useState } from "react";

const COLORS = ["#f6bd60", "#f6bd60", "#f28482", "#f5cac3", "#84a59d"];
const N = 10;
const SPOKES = Array.from({ length: N }, (_, i) => {
  const a = (i / N) * Math.PI * 2;
  // Rounded so server and client markup match exactly.
  return { x: Math.round(Math.cos(a) * 3400) / 100, y: Math.round(Math.sin(a) * 3400) / 100, i };
});

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A dandelion head. Click it and it scatters, sending pollen drifting across the page before the head grows back. */
export function PollenBurst({ className = "", size = "size-56 sm:size-72" }: { className?: string; size?: string }) {
  const [scattered, setScattered] = useState(false);
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const layer = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const puff = (x: number, y: number, size: number, color: string) => {
    const host = layer.current;
    if (!host) return;
    const el = document.createElement("span");
    el.style.cssText = `position:absolute;left:0;top:0;width:${size}px;height:${size}px;border-radius:9999px;background:${color};will-change:transform,opacity`;
    host.appendChild(el);
    const tx = window.innerWidth * (0.03 + Math.random() * 0.94);
    const ty = window.innerHeight * (0.05 + Math.random() * 0.9);
    const s = 0.35 + Math.random() * 0.5;
    const driftX = (Math.random() - 0.5) * 120;
    const driftY = -30 - Math.random() * 90;
    const dur = 3200 + Math.random() * 2600;
    const place = (px: number, py: number, sc: number) => `translate(${px - size / 2}px, ${py - size / 2}px) scale(${sc})`;
    const anim = el.animate(
      [
        { transform: place(x, y, 1), opacity: 1, easing: "cubic-bezier(.12,.8,.2,1)" },
        { transform: place(tx, ty, s), opacity: 1, offset: 0.3 },
        { transform: place(tx + driftX, ty + driftY, s * 0.8), opacity: 0 },
      ],
      { duration: dur, fill: "forwards" },
    );
    anim.onfinish = () => el.remove();
  };

  const scatter = () => {
    if (busy.current || reduced()) return;
    busy.current = true;
    setScattered(true);
    dots.current.forEach((d, i) => {
      if (!d) return;
      const r = d.getBoundingClientRect();
      puff(r.left + r.width / 2, r.top + r.height / 2, r.width, i === 2 ? "#f28482" : "#f6bd60");
    });
    const c = dots.current[0]?.ownerSVGElement?.getBoundingClientRect();
    if (c) {
      for (let k = 0; k < 18; k++) {
        puff(c.left + c.width / 2, c.top + c.height / 2, 7 + Math.random() * 9, COLORS[Math.floor(Math.random() * COLORS.length)]);
      }
    }
    timer.current = window.setTimeout(() => {
      setScattered(false);
      window.setTimeout(() => (busy.current = false), 900);
    }, 3000);
  };

  return (
    <>
      <div ref={layer} aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden" />
      <div className={`flex flex-col items-center gap-3 ${className}`}>
        <button
          type="button"
          onClick={scatter}
          aria-label="Scatter the pollen"
          className="rounded-full p-4 transition-transform duration-300 hover:scale-105 focus-visible:outline-offset-4"
        >
          <svg viewBox="-50 -50 100 100" data-scattered={scattered} className={`pp-head-sway overflow-visible ${size}`}>
            {SPOKES.map(({ x, y, i }) => (
              <g key={i}>
                <line className="pp-head-line" x1="0" y1="0" x2={x} y2={y} stroke="#2b3a36" strokeWidth="1.5" strokeLinecap="round" style={{ "--d": `${0.5 + i * 0.07}s` } as React.CSSProperties} />
                <circle
                  ref={(el) => {
                    dots.current[i] = el;
                  }}
                  className="pp-head-dot"
                  cx={x}
                  cy={y}
                  r={i === 2 ? 5.5 : 5}
                  fill={i === 2 ? "#f28482" : "#f6bd60"}
                  style={{ "--d": `${0.6 + i * 0.07}s` } as React.CSSProperties}
                />
              </g>
            ))}
            <circle r="4" fill="#2b3a36" />
          </svg>
        </button>
      </div>
    </>
  );
}
