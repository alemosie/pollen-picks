// Server-only: reading the log behind the History page (db/supabase/0014, 0015 and 0016). One row per attempt to create a post in Buffer, failed ones
// included. The send queue (./sendQueue) writes it. It keeps no images, and no caption once a post has been created or has failed: only where the post
// went, how it ended and how it stands in Buffer.

import { db } from "./db";
import { STATUS_GROUPS, type HistoryFacets, type HistoryFilters } from "./historyFilters";
import { getPostStates } from "./bufferPost";

export type HistoryEntry = {
  id: number;
  /** Buffer's id for the post. Empty for an attempt that failed or died before Buffer answered. */
  postId: string | null;
  service: string;
  channelName: string;
  mode: "draft" | "now";
  newsletter: string;
  issueTitle: string;
  slides: number | null;
  /** Buffer's PostStatus as last seen (draft | scheduled | sending | sent | error | needs_approval), or ours: failed | unknown. */
  status: string;
  liveUrl: string | null;
  /** Why it failed, for a failed or unknown attempt. */
  error: string | null;
  /** Buffer's id for the channel it was sent to. */
  channelId: string | null;
  /** One press of "Send": its entries share this. */
  batchId: string | null;
  createdAt: string;
  /** Waiting to be retried because Buffer asked us to slow down (a rate limit), not because it simply hasn't had its turn yet. */
  heldUp: boolean;
  /** Failed, and its caption is still kept, so it can be put back in the queue. */
  retryable: boolean;
};

type Row = {
  id: number;
  post_id: string | null;
  service: string;
  channel_name: string;
  mode: "draft" | "now";
  newsletter: string;
  issue_title: string;
  slides: number | null;
  status: string;
  live_url: string | null;
  error: string | null;
  channel_id: string | null;
  batch_id: string | null;
  created_at: string;
  attempts: number;
  caption: string | null;
};
const COLUMNS = "id, post_id, service, channel_name, mode, newsletter, issue_title, slides, status, live_url, error, channel_id, batch_id, created_at, attempts, caption";

const toEntry = (r: Row): HistoryEntry => ({
  id: r.id,
  postId: r.post_id,
  service: r.service,
  channelName: r.channel_name,
  mode: r.mode,
  newsletter: r.newsletter,
  issueTitle: r.issue_title,
  slides: r.slides,
  status: r.status,
  liveUrl: r.live_url,
  error: r.error,
  channelId: r.channel_id,
  batchId: r.batch_id,
  createdAt: r.created_at,
  heldUp: r.status === "queued" && r.attempts > 0,
  // The caption itself never leaves the server: only whether there is one.
  retryable: r.status === "failed" && Boolean(r.caption),
});

/** Statuses that won't change again, so those rows are never asked about. ('queued' and 'working' are ours and are moved on by the send queue.) */
export const FINAL_STATUSES = ["sent", "error", "needs_approval", "draft", "failed", "unknown"] as const;
const FINAL = new Set<string>(FINAL_STATUSES);
/** Statuses of an entry the send queue is still working on. */
export const OPEN_STATUSES = ["queued", "working"] as const;
/** Posts older than this that never reached a final status are left alone: Buffer stopped changing them long ago. */
const ASK_FOR_DAYS = 14;

/** How long a failed post keeps its caption so it can be retried. After that it is erased the next time anyone reads the history. */
export const CAPTION_KEEP_HOURS = 24;

/** Erases captions kept for retries once they are too old. No background job: it happens whenever this account's history is read. */
async function purgeStaleCaptions(userId: string) {
  const before = new Date(Date.now() - CAPTION_KEEP_HOURS * 3_600_000).toISOString();
  const { error } = await db().from("post_history").update({ caption: null }).eq("user_id", userId).eq("status", "failed").not("caption", "is", null).lt("created_at", before);
  if (error) console.error("erasing old captions failed:", error.message);
}

/** Puts this user's failed entries (that still have their caption) back in the queue. Returns how many went back. Never touches 'unknown' ones. */
export async function requeueFailed(userId: string, ids: number[]): Promise<number> {
  await purgeStaleCaptions(userId);
  const { data, error } = await db()
    .from("post_history")
    .update({ status: "queued", error: null, attempts: 0, not_before: null, lease_until: null })
    .in("id", ids)
    .eq("user_id", userId)
    .eq("status", "failed")
    .not("caption", "is", null)
    .select("id");
  if (error) throw new Error(`Could not retry: ${error.message}`);
  return (data ?? []).length;
}

export async function listHistory(userId: string, opts: { limit?: number; batchId?: string; filters?: HistoryFilters } = {}): Promise<HistoryEntry[]> {
  const f = opts.filters ?? {};
  await purgeStaleCaptions(userId);
  let q = db().from("post_history").select(COLUMNS).eq("user_id", userId);
  if (opts.batchId) q = q.eq("batch_id", opts.batchId);
  if (f.service) q = q.eq("service", f.service.toLowerCase());
  if (f.channelId) q = q.eq("channel_id", f.channelId);
  if (f.mode) q = q.eq("mode", f.mode);
  if (f.status) q = q.in("status", [...STATUS_GROUPS[f.status].statuses]);
  const { data, error } = await q.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(opts.limit ?? 100);
  if (error) throw new Error(`Could not read your history: ${error.message}`);
  return ((data ?? []) as Row[]).map(toEntry);
}

/** The networks and channels this account has history for, for the filter bar. Newest first, so recent channels lead. */
export async function historyFacets(userId: string): Promise<HistoryFacets> {
  const { data, error } = await db()
    .from("post_history")
    .select("service, channel_id, channel_name")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`Could not read your history: ${error.message}`);
  const services = new Set<string>();
  const channels = new Map<string, { id: string; name: string; service: string }>();
  for (const r of (data ?? []) as { service: string; channel_id: string | null; channel_name: string }[]) {
    if (r.service) services.add(r.service.toLowerCase());
    if (r.channel_id && !channels.has(r.channel_id)) channels.set(r.channel_id, { id: r.channel_id, name: r.channel_name || r.service, service: r.service.toLowerCase() });
  }
  return { services: [...services].sort(), channels: [...channels.values()] };
}

/**
 * Asks Buffer about this user's recent publish-now posts that haven't reached a final status, saves what it says, and returns the list.
 * One request covers up to 25 posts (see getPostStates), so this stays light on Buffer's per-app rate limit.
 */
export async function refreshHistory(userId: string, token: string, opts: { batchId?: string; filters?: HistoryFilters } = {}): Promise<HistoryEntry[]> {
  const since = new Date(Date.now() - ASK_FOR_DAYS * 86_400_000).toISOString();
  const { data } = await db()
    .from("post_history")
    .select("id, post_id, status")
    .eq("user_id", userId)
    .eq("mode", "now")
    .not("post_id", "is", null)
    .gte("created_at", since)
    .not("status", "in", `(${[...FINAL].join(",")})`)
    .order("created_at", { ascending: false })
    .limit(25);
  const pending = ((data ?? []) as { id: number; post_id: string; status: string }[]).filter((p) => p.post_id);
  if (pending.length > 0) {
    const states = await getPostStates(token, pending.map((p) => p.post_id));
    await Promise.all(
      pending.map(async (p) => {
        const s = states[p.post_id];
        const patch = { checked_at: new Date().toISOString(), ...(s && !("error" in s) ? { status: s.status.slice(0, 30), live_url: s.externalLink ?? null } : {}) };
        const { error } = await db().from("post_history").update(patch).eq("id", p.id);
        if (error) console.error("updating a history entry failed:", error.message);
      }),
    );
  }
  return listHistory(userId, { batchId: opts.batchId, filters: opts.filters });
}
