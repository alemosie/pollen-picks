"use client";

import {
  Children,
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A swipeable row of slides. It is a plain horizontally scrolling strip that snaps to each slide, so touch
 * swiping and trackpad scrolling work natively. The arrows, dots and arrow keys scroll the same strip.
 */
export function Carousel({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  const slides = Children.toArray(children);
  const count = slides.length;
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const goTo = useCallback(
    (i: number) => {
      const el = track.current;
      if (!el) return;
      const n = Math.max(0, Math.min(count - 1, i));
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollTo({ left: n * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
    },
    [count],
  );

  const onScroll = () => {
    const el = track.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(index - 1);
    }
  };

  const arrow =
    "flex size-11 shrink-0 items-center justify-center rounded-full bg-surface ring-1 ring-ink/10 transition hover:-translate-y-0.5 hover:bg-accent focus-visible:outline-offset-4 disabled:pointer-events-none disabled:opacity-30";

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label}>
      <div
        ref={track}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        tabIndex={0}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] focus-visible:outline-offset-4 [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            className="w-full shrink-0 snap-center snap-always px-4 pb-6 pt-8"
          >
            {slide}
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="mt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label="Previous example"
            disabled={index === 0}
            onClick={() => goTo(index - 1)}
            className={arrow}
          >
            <ChevronLeft aria-hidden className="size-6" strokeWidth={2.5} />
          </button>
          <div className="flex items-center">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show example ${i + 1}`}
                aria-current={i === index}
                onClick={() => goTo(i)}
                className="flex size-8 items-center justify-center"
              >
                <span
                  className={`block size-3 rounded-full transition ${
                    i === index ? "scale-125 bg-coral" : "bg-ink/25"
                  }`}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Next example"
            disabled={index === count - 1}
            onClick={() => goTo(index + 1)}
            className={arrow}
          >
            <ChevronRight aria-hidden className="size-6" strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}
