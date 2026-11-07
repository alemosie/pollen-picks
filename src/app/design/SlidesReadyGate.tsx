"use client";

import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FlowLoader } from "@/components/FlowLoader";
import { useLoaderVisible } from "@/components/useLoaderVisible";

/** What a slide preview gets to tell the gate: it is on the page (`add`), and it has loaded or failed (`done`). */
export type SlideSlot = { done: () => void; remove: () => void };
type Gate = { ready: boolean; add: () => SlideSlot };
export const SlidesReadyContext = createContext<Gate | null>(null);

/**
 * Keeps the design step behind the loading animation until every slide preview on the page has been drawn (or has failed, or `maxMs` has passed),
 * so a refresh never shows grey frames that look like lost slides. Only the first load waits: once the slides are in, editing swaps previews quietly.
 * The content stays mounted under the animation (hidden, not removed), so the previews load meanwhile, all of them at once rather than as you scroll.
 * A quick load never shows the animation at all. `layoutKnown` is false until the page knows whether the saved layout is the standard one or yours:
 * the previews of the wrong one must not count as the slides being ready.
 */
export function SlidesReadyGate({ layoutKnown, maxMs = 15_000, label = "Drawing your slides…", children }: { layoutKnown: boolean; maxMs?: number; label?: string; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  // One entry per preview on the page: has it loaded (or failed) yet?
  const slots = useRef(new Map<number, boolean>());
  const nextId = useRef(0);
  const [tick, setTick] = useState(0);
  const recheck = useCallback(() => setTick((t) => t + 1), []);

  const add = useCallback((): SlideSlot => {
    const id = nextId.current++;
    slots.current.set(id, false);
    recheck();
    return {
      done: () => {
        if (slots.current.has(id)) {
          slots.current.set(id, true);
          recheck();
        }
      },
      remove: () => {
        slots.current.delete(id);
        recheck();
      },
    };
  }, [recheck]);

  useEffect(() => {
    if (ready || !layoutKnown) return;
    const all = [...slots.current.values()];
    if (all.length > 0 && !all.every(Boolean)) return;
    // Everything on the page has answered. The timer lets previews that mount in the same moment register first (they re-run this, which cancels it);
    // a page with no previews at all gets a moment longer before it counts as ready.
    const t = setTimeout(() => setReady(true), all.length === 0 ? 400 : 0);
    return () => clearTimeout(t);
  }, [tick, ready, layoutKnown]);

  // A preview that never answers must not keep the page from the person.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), maxMs);
    return () => clearTimeout(t);
  }, [maxMs]);

  // Once the animation is up it stays a little while (so it never blinks), and the step stays hidden for exactly as long.
  const showLoader = useLoaderVisible(!ready);
  const value = useMemo(() => ({ ready, add }), [ready, add]);
  return (
    <SlidesReadyContext.Provider value={value}>
      {showLoader && <FlowLoader label={label} />}
      <div className={ready && !showLoader ? undefined : "invisible"}>{children}</div>
    </SlidesReadyContext.Provider>
  );
}
