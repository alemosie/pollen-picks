"use client";

import { useSyncExternalStore } from "react";

// The bottom bar knows whether the next step is ready (something picked, a source chosen...) and where it goes.
// It publishes that here so the progress indicator can reveal the same link. Module-level because the two are
// siblings in the page (the header is rendered by the server, the bar by the client view), so no provider reaches both.
export type NextStep = { href: string; onNavigate?: () => void } | null;

let current: NextStep = null;
const listeners = new Set<() => void>();

export function setNextStep(next: NextStep) {
  if (current?.href === next?.href && !current === !next) return;
  current = next;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export const useNextStep = (): NextStep =>
  useSyncExternalStore(subscribe, () => current, () => null);
