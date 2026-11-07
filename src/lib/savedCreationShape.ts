// Client-safe: what a saved creation is and how a request for one is checked. The database side is in ./savedCreations (server only).
// A saved creation is the server's copy of one run of the flow for one issue: which issue, which picks, the slide design and what Write kept.
// No images are ever part of it: slides are drawn again from the picks and the design when it is opened.

import { parseLinkMode, parseOwnMode } from "./flow";
import type { FormatState } from "./progress";

// A saved creation can be saved from Design, Write or Send. The current run (the one the app keeps for you as you go) also covers Pick.
export const SAVED_STEPS = [3, 4, 5] as const;
export const RUN_STEPS = [2, 3, 4, 5] as const;
export type SavedStep = (typeof SAVED_STEPS)[number];
export type RunStep = (typeof RUN_STEPS)[number];
export const SAVED_STEP_NAMES: Record<RunStep, string> = { 2: "Pick", 3: "Design", 4: "Write", 5: "Send" };

/** The most picks a creation can hold (the same ceiling as the migration). */
export const MAX_SAVED_PICKS = 200;
const MAX_FORMAT_CHARS = 40_000;
const MAX_TEMPLATE_CHARS = 4_000;
const CAPTION_TABS = ["instagram", "link", "short"];

/** What a request to save carries, once checked. */
export type CreationInput = {
  source: string;
  link: string;
  picks: number[];
  template: string;
  format: FormatState | null;
  step: RunStep;
  newsletter: string;
  title: string;
};

/** A row as the History page lists it. The caption text and the design never leave the server in a list: only what is shown. */
export type SavedCreationSummary = {
  id: string;
  source: string;
  newsletter: string;
  title: string;
  picks: number;
  step: RunStep;
  hasCaption: boolean;
  updatedAt: string;
};

/** A creation as it is opened: everything the steps need to carry on. `dropped` counts picks that no longer exist in the issue. */
export type OpenedCreation = Omit<CreationInput, "format"> & {
  id: string;
  format: FormatState | null;
  dropped: number;
  /** The current run only: when the server last changed it, and the saved creation it keeps up to date (if any). */
  updatedAt?: string;
  savedId?: string | null;
  /** The current run only: when that saved creation was last changed, so autosave can keep it up to date from this device. */
  savedUpdatedAt?: string | null;
};

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** A source that names ONE issue. A plain "own" means "the newest issue", which changes, so picks saved against it would drift. */
export function isSavableSource(source: string): boolean {
  const own = parseOwnMode(source);
  if (own) return Boolean(own.publicationId && own.postId);
  return parseLinkMode(source) !== null;
}

/** The caption state, if it is the shape Write writes. Anything else is dropped rather than stored. */
export function cleanFormat(v: unknown): FormatState | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const f = v as Record<string, unknown>;
  if (typeof f.sig !== "string" || typeof f.order !== "string" || typeof f.tab !== "string") return null;
  const edited: Record<string, string> = {};
  if (f.edited && typeof f.edited === "object" && !Array.isArray(f.edited)) {
    for (const [k, val] of Object.entries(f.edited as Record<string, unknown>)) {
      if (CAPTION_TABS.includes(k) && typeof val === "string") edited[k] = val;
    }
  }
  const clean: FormatState = { sig: f.sig.slice(0, 7000), order: f.order.slice(0, 20), edited, tab: CAPTION_TABS.includes(f.tab) ? f.tab : "instagram" };
  return JSON.stringify(clean).length > MAX_FORMAT_CHARS ? null : clean;
}

const noSv = (sig: string) => sig.replace(/&sv=\d+/g, "");

/**
 * A write that did not see the stored copy's latest change (a new device, cleared browser storage, or "use this screen" after a conflict) must not
 * wipe the caption text the stored copy holds just because this screen has none of its own: the device never had it. Captions the incoming copy
 * does have win; the ones it lacks are kept, when both are for the same picks and design (the style version in the design does not count).
 */
export function keepStoredCaptions(stored: FormatState | null, incoming: FormatState | null): FormatState | null {
  if (!stored || !incoming || noSv(stored.sig) !== noSv(incoming.sig)) return incoming;
  const edited = { ...incoming.edited };
  for (const [k, v] of Object.entries(stored.edited)) if (!(k in edited) || edited[k] === "") edited[k] = v;
  return { ...incoming, edited };
}

/** Checks a request body. Returns the cleaned input, or the reason in words the person can read. */
export function parseCreationInput(body: unknown, steps: readonly RunStep[] = SAVED_STEPS): CreationInput | { error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const source = text(b.source, 200);
  if (!isSavableSource(source)) return { error: "Choose one issue before saving: this source doesn't point at a single issue." };
  const picks = Array.isArray(b.picks) ? b.picks.filter((n): n is number => Number.isInteger(n) && n >= 0) : [];
  const unique = [...new Set(picks)];
  if (unique.length === 0) return { error: "Pick something before saving." };
  if (unique.length > MAX_SAVED_PICKS) return { error: "That's too many picks to save." };
  const template = text(b.template, MAX_TEMPLATE_CHARS + 1);
  if (template.length > MAX_TEMPLATE_CHARS) return { error: "This design is too large to save." };
  const link = text(b.link, 2000);
  const step = (steps as readonly number[]).includes(b.step as number) ? (b.step as RunStep) : steps.includes(4) ? 4 : steps[0];
  const format = cleanFormat(b.format);
  // A caption saved for other picks or another design would be wrong here: it is only kept when it is for exactly these.
  const keep = format && format.sig === `${link}|${unique.join(",")}|${template}` ? format : null;
  return { source, link, picks: unique, template, format: keep, step, newsletter: text(b.newsletter, 200), title: text(b.title, 300) };
}

/** True for a row id as the database makes them. */
export const isCreationId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Whether two creations hold the same thing (issue, picks in order, design and caption), so a run that equals its saved copy has nothing unsaved. */
export function sameCreation(a: Pick<CreationInput, "source" | "picks" | "template" | "format">, b: Pick<CreationInput, "source" | "picks" | "template" | "format">): boolean {
  if (a.source !== b.source || a.template !== b.template) return false;
  if (a.picks.length !== b.picks.length || a.picks.some((p, i) => p !== b.picks[i])) return false;
  if (!a.format || !b.format) return !a.format && !b.format;
  if (a.format.sig !== b.format.sig || a.format.order !== b.format.order || a.format.tab !== b.format.tab) return false;
  const ka = Object.keys(a.format.edited).sort();
  const kb = Object.keys(b.format.edited).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a.format!.edited[k] === b.format!.edited[k]);
}

/**
 * Whether the server may write the current run. The run is one slot per account, shared by every device, so a write has to know what the
 * writer last saw (`ifUpdatedAt`, the time the server gave it). Without that, only a different issue may take the slot: that is a new run, and the
 * app has already asked about unsaved work. `force` is the person's answer to "keep mine".
 */
export function decideRunWrite(a: { existing: { source: string; updatedAt: string } | null; source: string; ifUpdatedAt: string | null; force: boolean; sameContent?: boolean }): "write" | "conflict" {
  // Nothing there, "keep mine", or the writer holds exactly what is already stored: nothing can be lost by writing.
  if (!a.existing || a.force || a.sameContent) return "write";
  if (a.ifUpdatedAt === null) return a.existing.source !== a.source ? "write" : "conflict";
  return new Date(a.existing.updatedAt).getTime() === new Date(a.ifUpdatedAt).getTime() ? "write" : "conflict";
}
