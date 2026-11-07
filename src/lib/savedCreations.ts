// Server-only: saved creations (db/supabase/0022_saved_creations.sql). One row per account and issue: the picks, the slide design and what Write kept
// for that issue, so the person can come back to it from any device. Never images. Kept until the person deletes it or deletes their account.

import { db } from "./db";
import { CUSTOM_BASE } from "./pollen/custom";
import { cleanFormat, keepStoredCaptions, sameCreation, type CreationInput, type OpenedCreation, type RunStep, type SavedCreationSummary } from "./savedCreationShape";

const SUMMARY = "id, source, newsletter, title, picks, step, updated_at, format";
type SummaryRow = { id: string; source: string; newsletter: string; title: string; picks: number[]; step: number; updated_at: string; format: { edited?: Record<string, string> } | null };

export const toStep = (n: number): RunStep => (n === 2 ? 2 : n === 3 ? 3 : n === 5 ? 5 : 4);

const toSummary = (r: SummaryRow): SavedCreationSummary => ({
  id: r.id,
  source: r.source,
  newsletter: r.newsletter,
  title: r.title,
  picks: r.picks.length,
  step: toStep(r.step),
  // Only whether hand-written caption text is kept, never the text itself.
  hasCaption: Boolean(r.format && Object.keys(r.format.edited ?? {}).length > 0),
  updatedAt: r.updated_at,
});

const fields = (c: CreationInput) => ({ source: c.source, link: c.link, picks: c.picks, template: c.template, format: c.format, step: c.step, newsletter: c.newsletter, title: c.title });

/** Saves a creation, replacing the account's earlier one for the same issue. Returns its id and the time the server gave it. */
export async function saveCreation(userId: string, c: CreationInput): Promise<{ id: string; updatedAt: string }> {
  const updatedAt = new Date().toISOString();
  const { data, error } = await db()
    .from("saved_creations")
    .upsert({ user_id: userId, ...fields(c), updated_at: updatedAt }, { onConflict: "user_id,source" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not save: ${error?.message ?? "no row returned"}`);
  return { id: (data as { id: string }).id, updatedAt };
}

/**
 * Autosave into a creation the person already saved. It only ever updates: a creation that was deleted stays deleted ("gone"). Unless `force`, the writer
 * must have seen the creation's latest `updatedAt`, so one device can't overwrite another's newer work ("conflict").
 */
export async function updateCreation(userId: string, id: string, c: CreationInput, ifUpdatedAt: string | null, force: boolean): Promise<{ updatedAt: string } | "gone" | { conflict: string }> {
  const cur = await db().from("saved_creations").select("updated_at, source, picks, template, format").eq("user_id", userId).eq("id", id).maybeSingle();
  if (cur.error) throw new Error(`Could not save: ${cur.error.message}`);
  if (!cur.data) return "gone";
  const row = cur.data as { updated_at: string; source: string; picks: number[]; template: string; format: unknown };
  if (row.source !== c.source) return "gone"; // a creation belongs to one issue
  const stale = !ifUpdatedAt || new Date(row.updated_at).getTime() !== new Date(ifUpdatedAt).getTime();
  // Holding exactly what is stored loses nothing by writing, so that is not a conflict.
  const same = sameCreation({ source: row.source, picks: row.picks, template: row.template, format: cleanFormat(row.format) }, c);
  if (!force && stale && !same) return { conflict: row.updated_at };
  const updatedAt = new Date().toISOString();
  // Not the writer's own latest copy: keep the stored captions this screen doesn't have (see keepStoredCaptions).
  const kept = stale ? keepStoredCaptions(cleanFormat(row.format), c.format) : c.format;
  const { data, error } = await db().from("saved_creations").update({ ...fields({ ...c, format: kept }), updated_at: updatedAt }).eq("user_id", userId).eq("id", id).select("id");
  if (error) throw new Error(`Could not save: ${error.message}`);
  return (data ?? []).length > 0 ? { updatedAt } : "gone";
}

/** The saved creation for one issue, if any (the caption and design included). */
export async function getCreationBySource(userId: string, source: string): Promise<(CreationInput & { id: string; updatedAt: string }) | null> {
  const { data, error } = await db().from("saved_creations").select("id, source, link, picks, template, format, step, newsletter, title, updated_at").eq("user_id", userId).eq("source", source).maybeSingle();
  if (error) throw new Error(`Could not read your saved creations: ${error.message}`);
  if (!data) return null;
  const r = data as { id: string; source: string; link: string; picks: number[]; template: string; format: unknown; step: number; newsletter: string; title: string; updated_at: string };
  return { id: r.id, updatedAt: r.updated_at, source: r.source, link: r.link, picks: r.picks, template: r.template, format: cleanFormat(r.format), step: toStep(r.step), newsletter: r.newsletter, title: r.title };
}

/** This account's saved creations, most recently saved first. */
export async function listCreations(userId: string): Promise<SavedCreationSummary[]> {
  const { data, error } = await db().from("saved_creations").select(SUMMARY).eq("user_id", userId).order("updated_at", { ascending: false }).limit(100);
  if (error) throw new Error(`Could not read your saved creations: ${error.message}`);
  return ((data ?? []) as SummaryRow[]).map(toSummary);
}

/** One creation to open, for its owner only. `dropped` is filled in by the caller once it knows which picks the issue still has. */
export async function getCreation(userId: string, id: string): Promise<OpenedCreation | null> {
  const { data, error } = await db().from("saved_creations").select("id, source, link, picks, template, format, step, newsletter, title, updated_at").eq("user_id", userId).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not open it: ${error.message}`);
  if (!data) return null;
  const r = data as { id: string; source: string; link: string; picks: number[]; template: string; format: unknown; step: number; newsletter: string; title: string; updated_at: string };
  return {
    id: r.id,
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
  };
}

/** Returns whether a row was deleted (only the owner's rows match). */
export async function deleteCreation(userId: string, id: string): Promise<boolean> {
  const { data, error } = await db().from("saved_creations").delete().eq("user_id", userId).eq("id", id).select("id");
  if (error) throw new Error(`Could not delete it: ${error.message}`);
  return (data ?? []).length > 0;
}

/**
 * The ids (in custom_picks) of the highlights that this account's saved creations use. Starting a new run wipes the account's highlights; these are
 * the ones it has to leave, or a saved creation would point at highlights that no longer exist.
 */
export async function savedHighlightIds(userId: string): Promise<number[]> {
  const { data, error } = await db().from("saved_creations").select("picks").eq("user_id", userId);
  if (error) throw new Error(`Could not read your saved creations: ${error.message}`);
  const ids = new Set<number>();
  for (const r of (data ?? []) as { picks: number[] }[]) for (const p of r.picks) if (p >= CUSTOM_BASE) ids.add(p - CUSTOM_BASE);
  return [...ids];
}
