"use client";

import { useRef, useState } from "react";

/** The carousel as it will look in the feed: one slide at a time, swipeable. Click a slide to see them all. */
export function SlideCarousel({ urls, compact = false }: { urls: string[]; compact?: boolean }) {
  const track = useRef<HTMLOListElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);

  const goTo = (i: number) => {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(urls.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="w-full">
      <div className="relative">
        <ol
          ref={track}
          aria-label="Carousel slides"
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl ring-1 ring-ink/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {urls.map((u, i) => (
            <li key={u} className="w-full shrink-0 snap-center">
              <button type="button" onClick={() => dialog.current?.showModal()} aria-label={`Slide ${i + 1} of ${urls.length}. Open all slides`} className="block w-full cursor-zoom-in">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt={`Slide ${i + 1} of ${urls.length}`} width={1080} height={1350} loading={i < 2 ? "eager" : "lazy"} className="aspect-[4/5] w-full bg-surface" />
              </button>
            </li>
          ))}
        </ol>
        {index > 0 && <NavButton dir="prev" small={compact} onClick={() => goTo(index - 1)} />}
        {index < urls.length - 1 && <NavButton dir="next" small={compact} onClick={() => goTo(index + 1)} />}
        <span className={`pointer-events-none absolute rounded-full bg-ink/80 font-bold text-cream ${compact ? "right-2 top-2 px-2 py-px text-[10px]" : "right-3 top-3 px-2.5 py-0.5 text-xs"}`}>
          {index + 1}/{urls.length}
        </span>
      </div>
      <div className={`mt-3 flex items-center ${compact ? "justify-center" : "justify-between"}`}>
        <div className={`gap-1.5 ${compact ? "hidden" : "flex"}`} aria-hidden>
          {urls.map((_, i) => (
            <span key={i} className={`size-2 rounded-full ${i === index ? "bg-ink" : "bg-ink/25"}`} />
          ))}
        </div>
        <button type="button" onClick={() => dialog.current?.showModal()} className="text-sm font-semibold underline underline-offset-4">
          View all slides
        </button>
      </div>

      <dialog
        ref={dialog}
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        aria-label="All slides"
        className="m-auto max-h-[92vh] w-[min(64rem,94vw)] rounded-2xl bg-page p-0 text-ink backdrop:bg-ink/60"
      >
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-2xl">All {urls.length} slides</h2>
          <button type="button" onClick={() => dialog.current?.close()} className="rounded-xl bg-ink px-4 py-2 font-bold text-cream hover:bg-ink-deep">
            Close
          </button>
        </div>
        <ol className="grid max-h-[calc(92vh-5rem)] grid-cols-2 gap-4 overflow-y-auto px-6 pb-6 sm:grid-cols-3">
          {urls.map((u, i) => (
            <li key={u} className="flex flex-col gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`Slide ${i + 1} of ${urls.length}`} width={1080} height={1350} loading="lazy" className="aspect-[4/5] w-full rounded-xl bg-surface ring-1 ring-ink/10" />
              <span className="text-xs font-semibold">{i + 1}</span>
            </li>
          ))}
        </ol>
      </dialog>
    </div>
  );
}

function NavButton({ dir, onClick, small = false }: { dir: "prev" | "next"; onClick: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "prev" ? "Previous slide" : "Next slide"}
      className={`absolute top-1/2 grid -translate-y-1/2 place-items-center rounded-full bg-cream/90 text-ink shadow ring-1 ring-ink/15 hover:bg-cream ${small ? "size-7" : "size-9"} ${dir === "prev" ? "left-1.5" : "left-auto right-1.5"}`}
    >
      <svg aria-hidden viewBox="0 0 20 20" className={small ? "size-4" : "size-5"} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d={dir === "prev" ? "M12 4l-6 6 6 6" : "M8 4l6 6-6 6"} />
      </svg>
    </button>
  );
}
