"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const PICKS = [
  "Papote Halloween brunch",
  "Mom meetup at Monti's World",
  "Dutch for Parents",
  "Sleep survey",
];
// Which slide each pick lands on, and at which step it lands.
const LANDS = [
  { slide: 0, at: 2 },
  { slide: 0, at: 4 },
  { slide: 1, at: 6 },
];
const LAST = 9;
// Background choices for slide 2: step 7 reaches for honey, step 8 selects it.
const SWATCHES = [
  { name: "cream", c: "bg-cream" },
  { name: "honey", c: "bg-honey" },
  { name: "blush", c: "bg-blush" },
  { name: "sage", c: "bg-sage" },
  { name: "coral", c: "bg-coral" },
];
const TICK = 1100;
const HOLD = 4200;

/** A looping, silent walk-through of the slide builder: picks drop onto slides, a second slide appears, a color changes. */
export type DemoEvent = {
  title: string;
  when: string | null;
  place: string | null;
  blurb: string;
};

export function BuilderDemo({ event }: { event: DemoEvent }) {
  const [step, setStep] = useState(0);
  const [still, setStill] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // Defer so the first client render matches the server HTML.
    const first = window.setTimeout(() => {
      if (reduced) {
        setStill(true);
        setStep(8);
      }
    }, 0);
    if (reduced) return () => window.clearTimeout(first);
    let timer: number | undefined;
    // Step by step, with a longer rest on the finished arrangement before it starts over.
    let at = 0;
    const run = () => {
      window.clearTimeout(timer);
      const next = () => {
        at = at >= LAST ? 0 : at + 1;
        setStep(at);
        timer = window.setTimeout(next, at === 8 ? HOLD : TICK);
      };
      timer = window.setTimeout(next, at === 8 ? HOLD : TICK);
    };
    const io = new IntersectionObserver(
      ([e]) => (e.isIntersecting ? run() : window.clearTimeout(timer)),
      { threshold: 0.3 },
    );
    if (box.current) io.observe(box.current);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(timer);
      io.disconnect();
    };
  }, []);

  const placed = (i: number) => LANDS[i] && step >= LANDS[i].at;
  const glowing = (i: number) => LANDS[i] && step === LANDS[i].at - 1;
  const slide2 = step >= 5;
  const onSlide = (s: number) =>
    LANDS.flatMap((l, i) => (l.slide === s && placed(i) ? [i] : []));
  const num = (i: number) => (LANDS[i] ? LANDS[i].slide + 1 : null);

  return (
    <div
      ref={box}
      aria-hidden
      data-still={still}
      className="mt-10 max-w-2xl -rotate-1 rounded-[2rem] bg-surface p-5 ring-1 ring-ink/10 sm:p-7"
    >
      <p className="mb-4 font-display text-xl">Build your own slides</p>
      <div className="flex flex-col-reverse gap-5 sm:flex-row sm:gap-6">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex gap-3">
            {[0, 1].map((s) => {
              const items = onSlide(s);
              const shown = s === 0 || slide2;
              const bg =
                s === 1 && step >= 8
                  ? "bg-honey"
                  : s === 0
                    ? "bg-card"
                    : "bg-cream";
              return (
                <div
                  key={s}
                  className={`flex aspect-[4/5] w-1/2 flex-col gap-1.5 rounded-2xl p-2.5 transition-[opacity,background-color,box-shadow] duration-500 sm:p-3 ${bg} ${shown ? "opacity-100" : "opacity-0"} border-2 ${items.length === 0 ? "border-dashed border-ink/25" : "border-transparent shadow-md"}`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wide">
                    Slide {s + 1}
                  </span>
                  {items.length === 0 && (
                    <span className="m-auto text-center text-[11px] font-semibold text-ink/60">
                      Drop picks here
                    </span>
                  )}
                  {s === 0 &&
                    items.map((i) => (
                      <span
                        key={i}
                        className="pp-rise rounded-lg bg-surface px-2 py-1.5 font-display text-xs leading-tight sm:text-sm"
                      >
                        {PICKS[i]}
                      </span>
                    ))}
                  {s === 1 && items.length > 0 && (
                    <div className="pp-rise flex flex-col">
                      {event.place && (
                        <p className="mb-1.5 hidden w-fit rounded-full bg-ink/10 sm:block px-2 py-0.5 text-[10px] font-bold">
                          {event.place}
                        </p>
                      )}
                      <p className="font-display text-sm leading-tight sm:text-lg">
                        {event.title}
                      </p>
                      {event.when && (
                        <p className="mt-1.5 text-[10px] font-semibold sm:text-xs">
                          {event.when}
                        </p>
                      )}
                      <p className="mt-1.5 line-clamp-4 text-[10px] leading-snug sm:text-xs">
                        {event.blurb}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div
            className={`flex items-center gap-2 transition-opacity duration-500 ${step >= 7 ? "opacity-100" : "opacity-0"}`}
          >
            <span className="mr-1 text-xs font-bold">Slide 2 background</span>
            {SWATCHES.map((w) => {
              const chosen = (step >= 8 ? "honey" : "cream") === w.name;
              const reaching = step === 7 && w.name === "honey";
              return (
                <span
                  key={w.name}
                  className={`grid size-6 place-items-center rounded-full transition-shadow duration-300 ${w.c} ${chosen ? "ring-2 ring-ink" : reaching ? "ring-2 ring-coral ring-offset-2 ring-offset-surface" : "ring-1 ring-ink/20"}`}
                >
                  {chosen && step >= 8 && (
                    <Check aria-hidden strokeWidth={3.5} className="size-3.5" />
                  )}
                </span>
              );
            })}
          </div>
        </div>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 sm:w-[13rem]">
          {PICKS.map((p, i) => (
            <li
              key={p}
              className={`flex items-center gap-2 rounded-lg bg-cream px-2.5 py-1.5 text-sm font-semibold transition duration-300 ${placed(i) ? "opacity-50" : ""} ${glowing(i) ? "ring-2 ring-ink" : "ring-1 ring-ink/10"}`}
            >
              <span className="min-w-0 flex-1 truncate">
                {i === 2 ? event.title : p}
              </span>
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-full bg-ink/15 text-[11px] font-bold transition-opacity ${placed(i) ? "opacity-100" : "opacity-0"}`}
              >
                {num(i)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
