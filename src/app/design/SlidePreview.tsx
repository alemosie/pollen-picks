"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { MARK_PATHS } from "@/lib/slides/mark";
import { SlidesReadyContext, type SlideSlot } from "./SlidesReadyGate";

// The standard placeholder (plain gray with the Pollen Picks mark), scaled to fill the frame, so the same one fits a small thumbnail and a large card.
// It is the same picture as the built-in gray one (lib/slides/stock.ts), drawn inline so the seeds floating off the dandelion can pulse while the slide loads.
const [DANDELION, ...SEEDS] = MARK_PATHS;
const K = 540 / 608; // the mark is about half the height of the 1000 x 1000 square
const MARK_AT = `translate(${(500 - 202 * K).toFixed(1)} ${(500 - 304 * K).toFixed(1)}) scale(${K.toFixed(4)}) translate(-157 -57)`;

/** Plain gray with the Pollen Picks mark. While `busy`, the seeds pulse one after another (still under reduced motion). */
function Placeholder({ busy }: { busy: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 block size-full">
      <rect width="1000" height="1000" fill="#d6d6d6" />
      <g transform={MARK_AT} fill="#f5f5f5" fillRule="evenodd">
        <path d={DANDELION} />
        {SEEDS.map((d, i) => (
          <path key={i} d={d} className={busy ? "pp-seed-pulse" : undefined} style={{ animationDelay: `${i * 0.28}s` }} />
        ))}
      </g>
    </svg>
  );
}

/**
 * A slide preview that is never an empty box. Slides are drawn on the server and can take a few seconds, so a quiet gray
 * placeholder with the Pollen Picks mark is there from the first paint and the picture fades in when it arrives. Once a picture has been shown it stays
 * until the next one is ready, so editing a slide swaps the image instead of blanking it.
 * Inside a SlidesReadyGate it also reports when its picture has loaded or failed, so the page can wait for all of them, and it loads at once (not as
 * you scroll) until then.
 */
export function SlidePreview({
  src,
  alt,
  hold = false,
  fill = false,
  eager = true,
  className = "",
}: {
  src?: string;
  alt: string;
  /** Keep the picture hidden (placeholder only) even if it has loaded, for example until the page knows which layout to show. */
  hold?: boolean;
  /** Fill a frame the parent already sizes (a thumbnail button) instead of making its own 4:5 card. */
  fill?: boolean;
  eager?: boolean;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const shown = loaded && !hold;
  const gate = useContext(SlidesReadyContext);
  const add = gate?.add;
  const img = useRef<HTMLImageElement | null>(null);
  const slot = useRef<SlideSlot | null>(null);
  useEffect(() => {
    if (!src || !add) return;
    const s = add();
    slot.current = s;
    // A picture that finished (or failed) before this ran is already `complete`; its load event has come and gone.
    if (img.current?.complete) s.done();
    return () => {
      s.remove();
      slot.current = null;
    };
  }, [src, add]);
  return (
    <span
      className={
        fill
          ? `absolute inset-0 block bg-[#d6d6d6] ${className}`
          : `relative block aspect-[4/5] w-full overflow-hidden rounded-2xl bg-[#d6d6d6] ring-1 ring-ink/10 ${className}`
      }
    >
      <Placeholder busy={!shown} />
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          // A picture that finished loading before React attached (it is in the server's HTML) has already fired its load event.
          ref={(el) => {
            img.current = el;
            if (el?.complete && el.naturalWidth > 0) setLoaded(true);
          }}
          src={src}
          alt={alt}
          width={540}
          height={675}
          loading={eager || (gate && !gate.ready) ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => {
            setLoaded(true);
            slot.current?.done();
          }}
          onError={() => slot.current?.done()}
          className={`absolute inset-0 size-full object-cover motion-safe:transition-opacity motion-safe:duration-300 ${shown ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </span>
  );
}
