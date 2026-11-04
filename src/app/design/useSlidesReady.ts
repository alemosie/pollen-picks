import { useEffect, useState } from "react";

/**
 * False until the first slide previews on the page have loaded (or failed, or `maxMs` has passed). Slide images are drawn on
 * the server and can take a while, so the design step keeps its loading animation up until they are there instead of
 * showing empty frames. The images are in the server's HTML, so some may already be done before this runs.
 */
export function useSlidesReady(count = 5, maxMs = 10_000): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const imgs = [...document.querySelectorAll<HTMLImageElement>('img[src^="/api/slide/preview"]')].slice(0, count);
    const pending = imgs.filter((img) => !img.complete);
    if (pending.length === 0) {
      const t = setTimeout(() => setReady(true), 0);
      return () => clearTimeout(t);
    }
    let left = pending.length;
    const done = () => {
      if (--left === 0) setReady(true);
    };
    for (const img of pending) {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    }
    const cap = setTimeout(() => setReady(true), maxMs);
    return () => {
      clearTimeout(cap);
      for (const img of pending) {
        img.removeEventListener("load", done);
        img.removeEventListener("error", done);
      }
    };
  }, [count, maxMs]);
  return ready;
}
