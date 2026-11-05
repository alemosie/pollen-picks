import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { loaderChainStart } from "./FlowLoader";

const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;
/** A page-level loader fades in after this long (see .pp-flow-stage), so a loader that carries on from it counts from the same start. */
const FALLBACK_DELAY_MS = 1000;

/**
 * Whether to show a loader while `waiting`. Quick waits never show it (nothing flashes in and straight out), and once it is
 * up it stays for at least `minMs`, so it never blinks. Callers hide the content that isn't ready yet, so the next step
 * doesn't flash before the loader decides to appear.
 */
export function useLoaderVisible(waiting: boolean, delayMs = 600, minMs = 800): boolean {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);
  // Straight after another loader: if it was already visible, this one takes over in the same frame (no empty moment between them).
  useBeforePaint(() => {
    const since = loaderChainStart();
    if (waiting && since !== null && Date.now() - since >= FALLBACK_DELAY_MS) {
      shownAt.current = Date.now();
      setVisible(true);
    }
  }, []);
  useEffect(() => {
    if (waiting && !visible) {
      // Carrying on from a loader that has not faded in yet: wait out what is left of its delay, not a fresh one.
      const since = loaderChainStart();
      const wait = since !== null ? Math.max(0, FALLBACK_DELAY_MS - (Date.now() - since)) : delayMs;
      const t = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, wait);
      return () => clearTimeout(t);
    }
    if (!waiting && visible) {
      const t = setTimeout(() => setVisible(false), Math.max(0, minMs - (Date.now() - shownAt.current)));
      return () => clearTimeout(t);
    }
  }, [waiting, visible, delayMs, minMs]);
  return visible;
}
