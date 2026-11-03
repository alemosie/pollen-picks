// Where the user got to in the flow, kept in localStorage so a closed tab or a detour doesn't lose it.
// Every access is wrapped: storage can be blocked or empty (private windows, cleared data).
const KEY = "pollen-picks:progress";
const PICKED = "pollen-picks:picked";
const FORMAT = "pollen-picks:format";
const TEMPLATE = "pollen-picks:template";

import type { CustomSpec } from "@/lib/slides/options";

export const STEP_NAMES = [
  "Source",
  "Pick",
  "Design",
  "Prepare",
  "Send",
] as const;

export type Progress = { href: string; step: number; savedAt: number };

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const loadProgress = () => read<Progress>(KEY);
export const saveProgress = (href: string, step: number) =>
  write(KEY, { href, step, savedAt: Date.now() } satisfies Progress);

// Picks are positions in one issue's list, so they only mean something for that issue. They are saved with the
// flow `scope` (the mode, which carries the issue) and only restored for the same one. Called without a scope
// (the share link) it returns whatever was saved last.
type SavedPicks = { scope: string; ids: number[] };
export function loadPicked(scope?: string): number[] | null {
  const v = read<number[] | SavedPicks>(PICKED);
  if (!v) return null;
  if (Array.isArray(v)) return scope === undefined ? v : null; // saved before picks were scoped: can't tell which issue
  return scope === undefined || v.scope === scope ? v.ids : null;
}
export const savePicked = (ids: number[], scope: string) => write(PICKED, { scope, ids } satisfies SavedPicks);

export type FormatState = {
  sig: string;
  selected: string[];
  order: string;
  edited: Record<string, string>;
  tab: string;
};
export const loadFormat = () => read<FormatState>(FORMAT);
export const saveFormat = (s: FormatState) => {
  let same = false;
  try {
    same = localStorage.getItem(FORMAT) === JSON.stringify(s);
  } catch {}
  write(FORMAT, s);
  // Flash "Saved" only for a real change, not when the page rewrites what it just restored.
  if (!same) notifySaved();
};

/** `scope` is the flow mode (which carries the issue) the layout was made for: slide ids only mean something for that issue. */
export type TemplateState = { custom: boolean; spec: CustomSpec; scope?: string };
export const loadTemplate = () => read<TemplateState>(TEMPLATE);
/** Raw stored string, for useSyncExternalStore (must be a stable value between reads). */
export const templateSnapshot = (): string | null => {
  try {
    return localStorage.getItem(TEMPLATE);
  } catch {
    return null;
  }
};
export const SAVED_EVENT = "pollen-picks:saved";
/** Lets the page header flash "Saved". */
function notifySaved() {
  try {
    window.dispatchEvent(new Event(SAVED_EVENT));
  } catch {}
}
export const saveTemplate = (s: TemplateState) => {
  write(TEMPLATE, s);
  notifySaved();
};

/** Forget everything: after a finished send, or "Start over". */
export function clearProgress() {
  try {
    for (const k of [KEY, PICKED, FORMAT, TEMPLATE]) localStorage.removeItem(k);
  } catch {}
}
