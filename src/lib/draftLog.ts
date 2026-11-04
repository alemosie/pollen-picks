// Server-only: a row per draft the signed-in flow tried to create (see db/supabase/0005_demo_events_and_draft_log.sql).
// It holds the network and whether it worked, never the content. Best effort: a failed write is only logged.

import { db } from "./db";

export type DraftLogRow = { service: string; ok: boolean; error?: string };

export async function logDrafts(userId: string, rows: DraftLogRow[]): Promise<void> {
  if (rows.length === 0) return;
  try {
    const { error } = await db()
      .from("draft_log")
      .insert(
        rows.map((r) => ({
          user_id: userId,
          service: r.service.toLowerCase().slice(0, 40) || "unknown",
          ok: r.ok,
          error: r.ok ? null : (r.error ?? "").slice(0, 200) || null,
        })),
      );
    if (error) console.error("draft log failed:", error.message);
  } catch (e) {
    console.error("draft log failed:", (e as Error).message);
  }
}
