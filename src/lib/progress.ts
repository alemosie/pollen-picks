// Where the user got to in the flow, kept in localStorage so a closed tab or a detour doesn't lose it.
// Every access is wrapped: storage can be blocked or empty (private windows, cleared data).
const KEY = "pollen-picks:progress";
const PICKED = "pollen-picks:picked";
const FORMAT = "pollen-picks:format";
const TEMPLATE = "pollen-picks:template";

import type { CustomSpec } from "@/lib/slides/options";

export const STEP_NAMES = ["Source", "Pick", "Create", "Format", "Send"] as const;

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
export const saveProgress = (href: string, step: number) => write(KEY, { href, step, savedAt: Date.now() } satisfies Progress);

export const loadPicked = () => read<number[]>(PICKED);
export const savePicked = (ids: number[]) => write(PICKED, ids);

export type FormatState = { sig: string; selected: string[]; order: string; edited: Record<string, string>; tab: string };
export const loadFormat = () => read<FormatState>(FORMAT);
export const saveFormat = (s: FormatState) => write(FORMAT, s);

export type TemplateState = { custom: boolean; spec: CustomSpec };
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
export const saveTemplate = (s: TemplateState) => {
  write(TEMPLATE, s);
  // Lets the page header flash "Saved".
  try {
    window.dispatchEvent(new Event(SAVED_EVENT));
  } catch {}
};

/** Forget everything: after a finished send, or "Start over". */
export function clearProgress() {
  try {
    for (const k of [KEY, PICKED, FORMAT, TEMPLATE]) localStorage.removeItem(k);
  } catch {}
}
