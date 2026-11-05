// Server-only: the user's highlights, stored in public.custom_picks (see db/supabase/0004_custom_picks.sql).

import { db } from "./db";
import { CUSTOM_BASE, MAX_HIGHLIGHTS_PER_ISSUE, customChunk, type CustomRow } from "./pollen/custom";

type DbRow = { id: number; text: string; url: string | null; link_text: string | null };
const fromDb = (r: DbRow): CustomRow => ({ id: r.id, text: r.text, url: r.url, linkText: r.link_text });

export const issueKey = (publicationId: string, postId: string) => `${publicationId}:${postId}`;

export async function listCustomChunks(userId: string, issue: string) {
  const { data, error } = await db().from("custom_picks").select("id, text, url, link_text").eq("user_id", userId).eq("issue", issue).order("id");
  if (error) throw new Error(`Could not read highlights: ${error.message}`);
  return ((data ?? []) as DbRow[]).map(fromDb).map(customChunk);
}

/** Saves a highlight. Returns null when the issue already has the maximum. */
export async function addCustomChunk(userId: string, issue: string, text: string, url: string | null, linkText: string | null = null) {
  const count = await db().from("custom_picks").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("issue", issue);
  if (count.error) throw new Error(`Could not count highlights: ${count.error.message}`);
  if ((count.count ?? 0) >= MAX_HIGHLIGHTS_PER_ISSUE) return null;
  const { data, error } = await db().from("custom_picks").insert({ user_id: userId, issue, text, url, link_text: linkText }).select("id, text, url, link_text").single();
  if (error || !data) throw new Error(`Could not save the highlight: ${error?.message ?? "no row returned"}`);
  return customChunk(fromDb(data as DbRow));
}

/** Deletes all of the user's highlights: a new source starts a new run, and the last run's highlights are not carried into it. */
export async function clearCustomChunks(userId: string): Promise<void> {
  const { error } = await db().from("custom_picks").delete().eq("user_id", userId);
  if (error) throw new Error(`Could not clear highlights: ${error.message}`);
}

/** Deletes one highlight by its chunk id. Only the owner's rows for that issue match. */
export async function removeCustomChunk(userId: string, issue: string, chunkId: number): Promise<void> {
  const id = chunkId - CUSTOM_BASE;
  if (!Number.isInteger(id) || id < 1) return;
  const { error } = await db().from("custom_picks").delete().eq("id", id).eq("user_id", userId).eq("issue", issue);
  if (error) throw new Error(`Could not remove the highlight: ${error.message}`);
}
