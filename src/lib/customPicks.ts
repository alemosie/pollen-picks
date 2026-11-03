// Server-only: the user's highlights, stored in public.custom_picks (see db/supabase/0004_custom_picks.sql).

import { db } from "./db";
import { CUSTOM_BASE, MAX_HIGHLIGHTS_PER_ISSUE, customChunk, type CustomRow } from "./pollen/custom";

export const issueKey = (publicationId: string, postId: string) => `${publicationId}:${postId}`;

export async function listCustomChunks(userId: string, issue: string) {
  const { data, error } = await db().from("custom_picks").select("id, text, url").eq("user_id", userId).eq("issue", issue).order("id");
  if (error) throw new Error(`Could not read highlights: ${error.message}`);
  return ((data ?? []) as CustomRow[]).map(customChunk);
}

/** Saves a highlight. Returns null when the issue already has the maximum. */
export async function addCustomChunk(userId: string, issue: string, text: string, url: string | null) {
  const count = await db().from("custom_picks").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("issue", issue);
  if (count.error) throw new Error(`Could not count highlights: ${count.error.message}`);
  if ((count.count ?? 0) >= MAX_HIGHLIGHTS_PER_ISSUE) return null;
  const { data, error } = await db().from("custom_picks").insert({ user_id: userId, issue, text, url }).select("id, text, url").single();
  if (error || !data) throw new Error(`Could not save the highlight: ${error?.message ?? "no row returned"}`);
  return customChunk(data as CustomRow);
}

/** Deletes one highlight by its chunk id. Only the owner's rows for that issue match. */
export async function removeCustomChunk(userId: string, issue: string, chunkId: number): Promise<void> {
  const id = chunkId - CUSTOM_BASE;
  if (!Number.isInteger(id) || id < 1) return;
  const { error } = await db().from("custom_picks").delete().eq("id", id).eq("user_id", userId).eq("issue", issue);
  if (error) throw new Error(`Could not remove the highlight: ${error.message}`);
}
