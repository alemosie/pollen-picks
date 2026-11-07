// Server-only: the current run (db/supabase/0022_saved_creations.sql, table current_runs). The one run of the flow the app keeps for an account as it goes,
// so another device can carry on where this one stopped. One row per account, replaced when a new run starts and deleted when the send is queued.
// It holds the caption text while the run is in progress (the privacy page says so).

import { db } from "./db";
import { decideRunWrite, sameCreation, cleanFormat, type CreationInput, type OpenedCreation } from "./savedCreationShape";
import { getCreationBySource, saveCreation, toStep } from "./savedCreations";

type Row = { source: string; link: string; picks: number[]; template: string; format: unknown; step: number; newsletter: string; title: string; saved_id: string | null; updated_at: string };
const COLUMNS = "source, link, picks, template, format, step, newsletter, title, saved_id, updated_at";

const toRun = (r: Row): OpenedCreation => ({
  id: "run",
  source: r.source,
  link: r.link,
  picks: r.picks,
  template: r.template,
  format: cleanFormat(r.format),
  step: toStep(r.step),
  newsletter: r.newsletter,
  title: r.title,
  dropped: 0,
  updatedAt: r.updated_at,
  savedId: r.saved_id,
});

export async function getRun(userId: string): Promise<OpenedCreation | null> {
  const { data, error } = await db().from("current_runs").select(COLUMNS).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`Could not read your current run: ${error.message}`);
  return data ? toRun(data as Row) : null;
}

/**
 * Autosave. Writes the run unless another device changed it since this one last looked (see decideRunWrite): then it answers "conflict" and
 * changes nothing. `savedId` is the saved creation this run keeps up to date; it is only kept if it is this account's own.
 */
export async function putRun(userId: string, c: CreationInput, opts: { ifUpdatedAt: string | null; force: boolean; savedId: string | null }): Promise<{ updatedAt: string } | { conflict: string }> {
  const cur = await db().from("current_runs").select(COLUMNS).eq("user_id", userId).maybeSingle();
  if (cur.error) throw new Error(`Could not save your run: ${cur.error.message}`);
  const row = cur.data ? toRun(cur.data as Row) : null;
  const existing = row ? { source: row.source, updatedAt: row.updatedAt! } : null;
  // A browser that has no memory of the stored run (cleared storage, a new device) but holds exactly what is stored loses nothing by writing: no question to ask.
  const sameContent = Boolean(row && sameCreation(row, c));
  if (decideRunWrite({ existing, source: c.source, ifUpdatedAt: opts.ifUpdatedAt, force: opts.force, sameContent }) === "conflict") return { conflict: existing!.updatedAt };
  let savedId: string | null = null;
  if (opts.savedId) {
    const mine = await getCreationBySource(userId, c.source);
    if (mine && mine.id === opts.savedId) savedId = mine.id;
  }
  const updatedAt = new Date().toISOString();
  const { error } = await db()
    .from("current_runs")
    .upsert(
      { user_id: userId, source: c.source, link: c.link, picks: c.picks, template: c.template, format: c.format, step: c.step, newsletter: c.newsletter, title: c.title, saved_id: savedId, updated_at: updatedAt },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(`Could not save your run: ${error.message}`);
  return { updatedAt };
}

/** Discards the run. With `source`, only if it is the run of that issue (the send of one issue must not delete another's run). */
export async function deleteRun(userId: string, source?: string): Promise<void> {
  let q = db().from("current_runs").delete().eq("user_id", userId);
  if (source) q = q.eq("source", source);
  const { error } = await q;
  if (error) throw new Error(`Could not discard your run: ${error.message}`);
}

export type RunStatus = {
  run: { source: string; newsletter: string; title: string; picks: number; step: number; updatedAt: string } | null;
  /** The run holds work that no saved creation holds: replacing it would lose that work. */
  unsaved: boolean;
  /** A saved creation exists for the run's issue (saving the run would replace it). */
  hasSavedForIssue: boolean;
};

export async function runStatus(userId: string): Promise<RunStatus> {
  const run = await getRun(userId);
  if (!run) return { run: null, unsaved: false, hasSavedForIssue: false };
  const saved = await getCreationBySource(userId, run.source);
  return {
    run: { source: run.source, newsletter: run.newsletter, title: run.title, picks: run.picks.length, step: run.step, updatedAt: run.updatedAt! },
    unsaved: !saved || !sameCreation(run, saved),
    hasSavedForIssue: Boolean(saved),
  };
}

/** "Save it first": the run becomes (or replaces) the saved creation for its issue. A run still at Pick is saved as at Design. Returns false if there is no run. */
export async function saveRunAsCreation(userId: string): Promise<boolean> {
  const run = await getRun(userId);
  if (!run) return false;
  await saveCreation(userId, { source: run.source, link: run.link, picks: run.picks, template: run.template, format: run.format, step: run.step === 2 ? 3 : run.step, newsletter: run.newsletter, title: run.title });
  return true;
}
