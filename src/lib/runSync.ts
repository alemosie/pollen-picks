// Client-safe: what this browser knows about the server's copies of the run, so autosave only writes what it last saw (db/supabase/0022).
//   runUpdatedAt   : the time the server gave the last write of the current run that this browser made or loaded
//   savedId/Source : the saved creation this browser keeps up to date (set when the person saves, or opens a saved creation)
//   savedUpdatedAt : the time the server gave the last write of that saved creation
// Separate from the run itself ("pollen-picks:run"): starting over clears the run, not what the server last told us. Every access is wrapped.

import { clearProgress, saveFormat, savePicked, saveProgress } from "./progress";
import { stepUrl } from "./flow";
import type { OpenedCreation } from "./savedCreationShape";

const SYNC = "pollen-picks:sync";
export type Sync = { runUpdatedAt?: string; savedId?: string; savedSource?: string; savedUpdatedAt?: string };

export function loadSync(): Sync {
  try {
    const v = JSON.parse(localStorage.getItem(SYNC) ?? "null") as Sync | null;
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

/** Changes some fields; a field set to undefined is removed. */
export function patchSync(patch: { [K in keyof Sync]?: Sync[K] | undefined }) {
  try {
    const next: Record<string, unknown> = { ...loadSync(), ...patch };
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    localStorage.setItem(SYNC, JSON.stringify(next));
  } catch {}
}

/** The address of the step a run or creation opens at. */
export function openedUrl(c: Pick<OpenedCreation, "source" | "picks" | "template" | "step">): string {
  const q = `picks=${c.picks.join(",")}${c.template ? `&${c.template}` : ""}`;
  return stepUrl(c.source, c.step === 2 ? "pick" : c.step === 3 ? "design" : c.step === 5 ? "send" : "write", q);
}

/**
 * Puts a saved creation or the server's current run back as this browser's run, replacing the one that was there: the steps then find the same picks and
 * caption. For a saved creation the run slot on the server is expected to have been discarded by the caller, so only the saved creation is tracked.
 */
export function applyOpened(c: OpenedCreation, from: "run" | "saved") {
  clearProgress();
  savePicked(c.picks, `${c.source}|${c.link}`);
  if (c.format) saveFormat(c.format);
  saveProgress(openedUrl(c), c.step);
  if (from === "saved") patchSync({ runUpdatedAt: undefined, savedId: c.id, savedSource: c.source, savedUpdatedAt: c.updatedAt });
  else patchSync({ runUpdatedAt: c.updatedAt, savedId: c.savedId ?? undefined, savedSource: c.savedId ? c.source : undefined, savedUpdatedAt: c.savedUpdatedAt ?? undefined });
}

/** The run was replaced or discarded: the server holds nothing for this browser to compare with any more. */
export const forgetRun = () => patchSync({ runUpdatedAt: undefined, savedId: undefined, savedSource: undefined, savedUpdatedAt: undefined });
