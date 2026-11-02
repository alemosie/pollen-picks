"use client";

import { useState } from "react";

export type PickCard = {
  note: string;
  title: string;
  when: string | null;
  place: string | null;
  blurb: string;
};

// Each card's color, tilt and a little vertical stagger so the pile looks scattered but still reflows.
const SPOTS = [
  { c: "bg-honey", r: "-rotate-3", x: "mt-0" },
  { c: "bg-surface ring-1 ring-ink/10", r: "rotate-2", x: "mt-5" },
  { c: "bg-blush", r: "rotate-[5deg]", x: "mt-1" },
  { c: "bg-chip/70", r: "-rotate-[4deg]", x: "mt-4" },
  { c: "bg-card", r: "rotate-[3deg]", x: "mt-0" },
];

/** A messy pile of newsletter chores. "Pick me" turns a card, in place, into the Pollen Picks slide it becomes. */
export function PickMe({ cards }: { cards: PickCard[] }) {
  const [picked, setPicked] = useState<number[]>([]);
  const toggle = (i: number) =>
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  return (
    <ul className="m-0 flex max-w-3xl list-none flex-wrap items-start gap-x-3 gap-y-5 p-0 sm:gap-x-5 sm:gap-y-6">
      {cards.slice(0, SPOTS.length).map((card, i) => {
        const s = SPOTS[i];
        const on = picked.includes(i);
        return (
          <li
            key={card.title}
            className={`w-[calc(50%-0.375rem)] shadow-md transition-[transform,box-shadow] duration-300 sm:w-[13rem] ${s.x} ${on ? "rotate-0 shadow-lg" : `${s.r} hover:rotate-0`}`}
          >
            {on ? (
              <div
                className={`pp-pop flex aspect-[4/5] flex-col rounded-3xl p-3 sm:p-5 ${s.c}`}
              >
                {card.place && (
                  <p className="mb-2 w-fit rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-bold sm:text-xs">
                    {card.place}
                  </p>
                )}
                <p className="font-display text-base leading-tight sm:text-2xl">
                  {card.title}
                </p>
                {card.when && (
                  <p className="mt-2 text-[11px] font-semibold sm:text-sm">
                    {card.when}
                  </p>
                )}
                {card.blurb && (
                  <p className="mt-2 mb-3 line-clamp-3 text-[11px] leading-snug sm:line-clamp-4 sm:text-sm">
                    {card.blurb}
                  </p>
                )}
                <button
                  type="button"
                  aria-pressed
                  onClick={() => toggle(i)}
                  className="mt-auto w-fit rounded-full bg-ink/10 px-3 py-1 text-xs font-bold hover:bg-ink hover:text-cream"
                >
                  Undo
                </button>
              </div>
            ) : (
              <div className={`flex flex-col gap-3 rounded-2xl p-3.5 ${s.c}`}>
                <span className="font-display text-base leading-snug sm:text-lg">
                  {card.note}
                </span>
                <button
                  type="button"
                  aria-pressed={false}
                  aria-label={`Pick ${card.title}`}
                  onClick={() => toggle(i)}
                  className="w-fit rounded-full bg-ink px-3 py-1 text-xs font-bold text-cream hover:bg-ink-deep sm:text-sm"
                >
                  Pick me
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
