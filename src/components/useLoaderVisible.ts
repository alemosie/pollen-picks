import { useEffect, useRef, useState } from "react";

/**
 * Whether to show a loader while `waiting`. Quick waits never show it (nothing flashes in and straight out), and once it is
 * up it stays for at least `minMs`, so it never blinks. Callers hide the content that isn't ready yet, so the next step
 * doesn't flash before the loader decides to appear.
 */
export function useLoaderVisible(waiting: boolean, delayMs = 600, minMs = 800): boolean {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);
  useEffect(() => {
    if (waiting && !visible) {
      const t = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, delayMs);
      return () => clearTimeout(t);
    }
    if (!waiting && visible) {
      const t = setTimeout(() => setVisible(false), Math.max(0, minMs - (Date.now() - shownAt.current)));
      return () => clearTimeout(t);
    }
  }, [waiting, visible, delayMs, minMs]);
  return visible;
}
