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
  "Write",
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

// What Write saved: caption order, hand edits and the open tab, for one set of picks + template. (Older saves also hold a
// `selected` list from when channels were chosen on this step; it is ignored. Channels are chosen on Send now.)
export type FormatState = {
  sig: string;
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

// Which channels are ticked on Send. Not tied to one issue or set of picks: it is a habit of the account, so it survives a
// detour back to Pick and is still there next week. `known` is every usable channel seen last time, so a channel connected
// since then starts ticked (like on the first visit) instead of being treated as unticked on purpose.
const CHANNELS = "pollen-picks:channels";
export type ChannelChoice = { selected: string[]; known: string[] };
export const loadChannelChoice = () => read<ChannelChoice>(CHANNELS);
export const saveChannelChoice = (c: ChannelChoice) => write(CHANNELS, c);

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

/**
 * After a finished send: forget where the user "left off" (so there is no resume prompt), but keep what Write saved and the
 * picks and layout. Going back to /send (browser back, a bookmark, the Send step in the header) then still finds its caption
 * instead of asking for Write again.
 */
export function clearResume() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

// A send runs on the server, so this page can be closed or left while it goes on. The batch ids are kept so that coming back to /send for the same
// picks shows how it went (and doesn't offer to send it all again). Forgotten after two hours, by "Start a new send", or when a new flow is started from Source.
const SEND = "pollen-picks:send";
type SavedSend = { sig: string; batchIds: string[]; intent: "draft" | "now"; savedAt: number };
export function loadSendBatches(sig: string): { batchIds: string[]; intent: "draft" | "now" } | null {
  const v = read<SavedSend>(SEND);
  if (!v || v.sig !== sig || !Array.isArray(v.batchIds) || Date.now() - v.savedAt > 2 * 60 * 60 * 1000) return null;
  return { batchIds: v.batchIds.filter((b) => typeof b === "string"), intent: v.intent === "now" ? "now" : "draft" };
}
export const saveSendBatches = (sig: string, v: { batchIds: string[]; intent: "draft" | "now" }) => write(SEND, { sig, ...v, savedAt: Date.now() } satisfies SavedSend);
export function clearSendBatches() {
  try {
    localStorage.removeItem(SEND);
  } catch {}
}

/** Forget everything: "Start over". */
export function clearProgress() {
  try {
    for (const k of [KEY, PICKED, FORMAT, TEMPLATE, SEND]) localStorage.removeItem(k);
  } catch {}
}
