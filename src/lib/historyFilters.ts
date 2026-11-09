// Shared by the History page (client) and the db reads (server): which entries to show. Kept in the URL (?service=&channel=&status=&mode=) so a
// filtered view can be reloaded, bookmarked and handed to the refresh route.

/** The statuses an entry can be in, grouped the way people think about them. */
export const STATUS_GROUPS = {
  progress: { label: "In progress", statuses: ["queued", "working", "sending", "scheduled"] },
  done: { label: "Done", statuses: ["sent", "draft", "removed"] },
  failed: { label: "Failed", statuses: ["failed", "error"] },
  check: { label: "Needs a look", statuses: ["unknown", "needs_approval"] },
} as const;
export type StatusGroup = keyof typeof STATUS_GROUPS;

export type HistoryFilters = {
  /** Network, e.g. "linkedin". */
  service?: string;
  /** Buffer's id for one channel. */
  channelId?: string;
  status?: StatusGroup;
  /** Saved as a draft, or published now. */
  mode?: "draft" | "now";
};

const SERVICE = /^[a-z0-9_-]{1,40}$/i;
const CHANNEL = /^[\w.:-]{1,120}$/;

/** Reads filters from anything that looks up a query parameter. Unknown or malformed values are ignored. */
export function parseFilters(get: (key: string) => string | null | undefined): HistoryFilters {
  const service = get("service");
  const channel = get("channel");
  const status = get("status");
  const mode = get("mode");
  const f: HistoryFilters = {};
  if (service && SERVICE.test(service)) f.service = service;
  if (channel && CHANNEL.test(channel)) f.channelId = channel;
  if (status && Object.hasOwn(STATUS_GROUPS, status)) f.status = status as StatusGroup;
  if (mode === "draft" || mode === "now") f.mode = mode;
  return f;
}

export function filtersToQuery(f: HistoryFilters): string {
  const q = new URLSearchParams();
  if (f.service) q.set("service", f.service);
  if (f.channelId) q.set("channel", f.channelId);
  if (f.status) q.set("status", f.status);
  if (f.mode) q.set("mode", f.mode);
  return q.toString();
}

export const hasFilters = (f: HistoryFilters) => Boolean(f.service || f.channelId || f.status || f.mode);

/** What the filter bar offers: the networks and channels this account has history for. */
export type HistoryFacets = { services: string[]; channels: { id: string; name: string; service: string }[] };
