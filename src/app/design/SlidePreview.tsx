"use client";

import { useState } from "react";
import { STOCK_IMAGES } from "@/lib/slides/stock";

// The standard placeholder (plain gray with the Pollen Picks mark), scaled to fill the frame, so the same one fits a small thumbnail and a large card.
const PLACEHOLDER = `url("${STOCK_IMAGES[0].src}")`;

/**
 * A slide preview that is never an empty box. Slides are drawn on the server and can take a few seconds, so a quiet gray
 * placeholder with the Pollen Picks mark is there from the first paint and the picture fades in when it arrives. Once a picture has been shown it stays
 * until the next one is ready, so editing a slide swaps the image instead of blanking it.
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
  return (
    <span
      className={
        fill
          ? `absolute inset-0 block bg-[#d6d6d6] ${className}`
          : `relative block aspect-[4/5] w-full overflow-hidden rounded-2xl bg-[#d6d6d6] ring-1 ring-ink/10 ${className}`
      }
    >
      <span aria-hidden className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: PLACEHOLDER }} />
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          // A picture that finished loading before React attached (it is in the server's HTML) has already fired its load event.
          ref={(el) => {
            if (el?.complete && el.naturalWidth > 0) setLoaded(true);
          }}
          src={src}
          alt={alt}
          width={540}
          height={675}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 size-full object-cover motion-safe:transition-opacity motion-safe:duration-300 ${shown ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </span>
  );
}
