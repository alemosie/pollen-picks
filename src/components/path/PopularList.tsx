"use client";

import { Check, Plus } from "lucide-react";
import { useState, type CSSProperties } from "react";

export type PopularRow = {
  id: number;
  rank: number | null;
  title: string;
  pct: number;
};

const COLORS = ["#f6bd60", "#f6bd60", "#f28482", "#f5cac3", "#84a59d"];

/** A short pop of pollen right around the button. */
function confetti(from: Element) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = from.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText =
    "position:fixed;inset:0;z-index:60;pointer-events:none;overflow:hidden";
  document.body.appendChild(layer);
  const n = 14;
  let left = n;
  for (let k = 0; k < n; k++) {
    const size = 5 + Math.random() * 6;
    const el = document.createElement("span");
    el.style.cssText = `position:absolute;left:0;top:0;width:${size}px;height:${size}px;border-radius:9999px;background:${COLORS[k % COLORS.length]};will-change:transform,opacity`;
    layer.appendChild(el);
    const a = (k / n) * Math.PI * 2 + Math.random() * 0.5;
    const d = 28 + Math.random() * 44;
    const at = (px: number, py: number, s: number) =>
      `translate(${px - size / 2}px, ${py - size / 2}px) scale(${s})`;
    el.animate(
      [
        {
          transform: at(x, y, 0.4),
          opacity: 1,
          easing: "cubic-bezier(.12,.8,.2,1)",
        },
        {
          transform: at(x + Math.cos(a) * d, y + Math.sin(a) * d, 1),
          opacity: 1,
          offset: 0.45,
        },
        {
          transform: at(
            x + Math.cos(a) * (d + 14),
            y + Math.sin(a) * (d + 14) + 22,
            0.6,
          ),
          opacity: 0,
        },
      ],
      { duration: 800 + Math.random() * 400, fill: "forwards" },
    ).onfinish = () => {
      el.remove();
      if (--left === 0) layer.remove();
    };
  }
}

/** The "most clicked" bars. Press + to pick one: pollen pops and its bar turns green. */
export function PopularList({ rows }: { rows: PopularRow[] }) {
  const [picked, setPicked] = useState<number[]>([]);
  const toggle = (id: number, el: Element) => {
    const on = picked.includes(id);
    if (!on) confetti(el);
    setPicked((p) => (on ? p.filter((x) => x !== id) : [...p, id]));
  };
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {rows.map((c, i) => {
        const on = picked.includes(c.id);
        return (
          <li key={c.id}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm font-semibold">
              <span className="min-w-0 truncate">
                <span className="mr-2 font-display text-ink/60">#{c.rank}</span>
                {c.title}
              </span>
              <button
                type="button"
                aria-pressed={on}
                aria-label={`${on ? "Unpick" : "Pick"} ${c.title}`}
                onClick={(e) => toggle(c.id, e.currentTarget)}
                className={`grid size-7 shrink-0 place-items-center rounded-full transition ${on ? "bg-sage text-ink" : "bg-ink/10 hover:bg-ink hover:text-cream"}`}
              >
                {on ? (
                  <Check aria-hidden strokeWidth={3} className="size-4" />
                ) : (
                  <Plus aria-hidden strokeWidth={3} className="size-4" />
                )}
              </button>
            </div>
            <div className="h-3 rounded-full bg-cream">
              <div
                className={`pp-bar h-full rounded-full ${on ? "bg-sage" : i < 4 ? "bg-accent" : "bg-card"}`}
                style={
                  { "--w": `${c.pct}%`, "--d": `${i * 0.08}s` } as CSSProperties
                }
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
