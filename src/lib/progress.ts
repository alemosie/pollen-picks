// One run of the flow (source -> pick -> design -> write -> send) is kept as ONE record in localStorage, so it is either all
// there or all gone: it can never mix the picks of one issue with the layout or caption of another. Everything in it belongs
// to `scope` (the flow mode plus the issue's address). Saving picks or a layout for a different scope throws the rest of the
// record away; only "where you left off" survives, since that is always about now. Every access is wrapped: storage can be
// blocked or empty (private windows, cleared data).
const RUN = "pollen-picks:run";
// Before the record existed each piece had a key of its own (and its own idea of which issue it belonged to). They are dropped.
const LEGACY = ["pollen-picks:progress", "pollen-picks:picked", "pollen-picks:format", "pollen-picks:template", "pollen-picks:send"];

import type { CustomSpec } from "@/lib/slides/options";

export const STEP_NAMES = [
  "Source",
  "Pick",
  "Design",
  "Write",
  "Send",
] as const;

export type Progress = { href: string; step: number; savedAt: number };

// What Write saved: caption order, hand edits and the open tab, for one set of picks + template. (Older saves also hold a
// `selected` list from when channels were chosen on this step; it is ignored. Channels are chosen on Send now.)
export type FormatState = {
  sig: string;
  order: string;
  edited: Record<string, string>;
  tab: string;
};
/** `scope` is the flow mode (which carries the issue) the layout was made for: slide ids only mean something for that issue. */
export type TemplateState = { custom: boolean; spec: CustomSpec; scope?: string };
type SavedSend = { sig: string; batchIds: string[]; intent: "draft" | "now"; savedAt: number };

export type Run = {
  scope?: string;
  progress?: Progress;
  picked?: number[];
  format?: FormatState;
  template?: TemplateState;
  send?: SavedSend;
};

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
function dropLegacy() {
  try {
    for (const k of LEGACY) localStorage.removeItem(k);
  } catch {}
}

const readRun = (): Run => {
  const r = read<Run>(RUN);
  return r && typeof r === "object" && !Array.isArray(r) ? r : {};
};
const writeRun = (r: Run) => {
  write(RUN, r);
  dropLegacy();
};
/** The record to change. A scope that is not the saved one starts a new run (keeping only where the user is now). */
function runFor(scope?: string): Run {
  let r = readRun();
  if (scope !== undefined) {
    if (r.scope !== undefined && r.scope !== scope) r = { progress: r.progress };
    r.scope = scope;
  }
  return r;
}
/** Only what was saved for this scope; another issue's state is never handed out. */
const same = (r: Run, scope?: string) => scope === undefined || r.scope === undefined || r.scope === scope;

export const loadProgress = () => readRun().progress ?? null;
/** The flow mode (plus issue) the saved run belongs to, e.g. "demo". */
export const loadScope = () => readRun().scope ?? null;
export const saveProgress = (href: string, step: number) => writeRun({ ...readRun(), progress: { href, step, savedAt: Date.now() } });

// Picks are positions in one issue's list. Called without a scope (the share link) it returns whatever was saved last.
export function loadPicked(scope?: string): number[] | null {
  const r = readRun();
  return same(r, scope) && Array.isArray(r.picked) ? r.picked : null;
}
export const savePicked = (ids: number[], scope: string) => writeRun({ ...runFor(scope), picked: ids });

export const loadFormat = () => readRun().format ?? null;
export const saveFormat = (f: FormatState) => {
  const r = readRun();
  const unchanged = JSON.stringify(r.format) === JSON.stringify(f);
  writeRun({ ...r, format: f });
  // Flash "Saved" only for a real change, not when the page rewrites what it just restored.
  if (!unchanged) notifySaved();
};

// Which channels are ticked on Send. Not tied to one issue or set of picks: it is a habit of the account, so it survives a
// detour back to Pick and is still there next week. `known` is every usable channel seen last time, so a channel connected
// since then starts ticked (like on the first visit) instead of being treated as unticked on purpose.
const CHANNELS = "pollen-picks:channels";
export type ChannelChoice = { selected: string[]; known: string[] };
export const loadChannelChoice = () => read<ChannelChoice>(CHANNELS);
export const saveChannelChoice = (c: ChannelChoice) => write(CHANNELS, c);

export const loadTemplate = () => readRun().template ?? null;
/** Raw stored string, for useSyncExternalStore (must be a stable value between reads). */
export const templateSnapshot = (): string | null => {
  const t = readRun().template;
  return t ? JSON.stringify(t) : null;
};
export const SAVED_EVENT = "pollen-picks:saved";
/** Lets the page header flash "Saved". */
function notifySaved() {
  try {
    window.dispatchEvent(new Event(SAVED_EVENT));
  } catch {}
}
export const saveTemplate = (t: TemplateState) => {
  writeRun({ ...runFor(t.scope), template: t });
  notifySaved();
};

/**
 * After a finished send: forget where the user "left off" (so there is no resume prompt), but keep what Write saved and the
 * picks and layout. Going back to /send (browser back, a bookmark, the Send step in the header) then still finds its caption
 * instead of asking for Write again.
 */
export function clearResume() {
  const { progress: _gone, ...rest } = readRun(); // eslint-disable-line @typescript-eslint/no-unused-vars
  writeRun(rest);
}

// A send runs on the server, so this page can be closed or left while it goes on. The batch ids are kept so that coming back to /send for the same
// picks shows how it went (and doesn't offer to send it all again). Forgotten after two hours, by "Start a new send", or when a new flow is started from Source.
export function loadSendBatches(sig: string): { batchIds: string[]; intent: "draft" | "now" } | null {
  const v = readRun().send;
  if (!v || v.sig !== sig || !Array.isArray(v.batchIds) || Date.now() - v.savedAt > 2 * 60 * 60 * 1000) return null;
  return { batchIds: v.batchIds.filter((b) => typeof b === "string"), intent: v.intent === "now" ? "now" : "draft" };
}
export const saveSendBatches = (sig: string, v: { batchIds: string[]; intent: "draft" | "now" }) => writeRun({ ...readRun(), send: { sig, ...v, savedAt: Date.now() } });
export function clearSendBatches() {
  const { send: _gone, ...rest } = readRun(); // eslint-disable-line @typescript-eslint/no-unused-vars
  writeRun(rest);
}

// Choosing a source starts a new run. The browser's copy of the last run is dropped here at once; the server's (the highlights
// made on the Manual tab) is dropped by the Pick page's own request, which this cookie asks for. A cookie, not a call of its
// own, because the click that sets it also navigates: the Pick request carries it, so nothing has to be awaited and nothing
// can arrive late. The Pick page removes it again once it has loaded (see FreshRunDone).
export const FRESH_COOKIE = "pp_fresh";
/**
 * A new value for every fresh start, not just "1": the Pick page uses it in the Picker's React key (see pickerKey). Two fresh starts of the same issue
 * must not share a Picker, or the page left behind in the background comes back with its old picks and saves them again.
 */
const freshId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
/** What the Pick page accepts from the cookie: letters and digits only ("1", from before the id existed, still counts as fresh). */
export const readFreshId = (cookieValue: string | undefined): string => (cookieValue && /^[a-z0-9]{1,40}$/i.test(cookieValue) ? cookieValue : "");
export function startFreshRun() {
  clearProgress();
  try {
    document.cookie = `${FRESH_COOKIE}=${freshId()}; path=/; max-age=120; SameSite=Lax`;
  } catch {}
}
export function endFreshRun() {
  try {
    document.cookie = `${FRESH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  } catch {}
}

/** Forget everything: "Start over". */
export function clearProgress() {
  try {
    localStorage.removeItem(RUN);
    dropLegacy();
  } catch {}
}

/** The step the user was on, when it is a page of the app (not Settings itself, and never another site); else the first step. */
export const resumeHref = (href: string | undefined | null): string => (href && /^\/(?!\/)/.test(href) && !/^\/settings(\/|\?|#|$)/.test(href) ? href : "/source");

