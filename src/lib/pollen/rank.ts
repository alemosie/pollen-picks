import { dayNumber, isUpcoming } from "./dates";
import { looseKey, normalizeUrl } from "./url";
import type { Activity, ClickRow, LinkStats, Ranked } from "./types";

/**
 * Merges beehiiv's per-link click rows by normalized URL. The same link shows up several times (email vs web
 * archive, differently ordered tracking params), so rows are summed per key.
 * Score = unique *verified* email clickers + unique web clickers. Verified excludes bot/prefetch clicks.
 * Email and web uniques can overlap a little (the same person opening both); that is accepted for ranking.
 */
export function mergeClicks(rows: ClickRow[]): Map<string, LinkStats> {
  const m = new Map<string, LinkStats>();
  for (const r of rows) {
    const key = normalizeUrl(r.url);
    if (!key) continue;
    const s = m.get(key) ?? { key, score: 0, totalVerified: 0, rows: 0 };
    s.score += (r.email.total_unique_clicked_verified ?? r.email.unique_verified_clicks ?? 0) + (r.web.total_unique_clicked ?? r.web.unique_clicks ?? 0);
    s.totalVerified += (r.email.total_clicked_verified ?? r.email.verified_clicks ?? 0) + (r.web.total_clicked ?? r.web.clicks ?? 0);
    s.rows += 1;
    m.set(key, s);
  }
  return m;
}

export type RankOptions = {
  /** YYYY-MM-DD. Activities whose dates are all before this are "past". */
  today: string;
  /** Drop past activities (default true). Undated ones are kept unless `dropUndated`. */
  onlyUpcoming?: boolean;
  /** Drop activities with no parsable date (default false). */
  dropUndated?: boolean;
};

export function rankActivities(activities: Activity[], clicks: Map<string, LinkStats>, opts: RankOptions): Ranked[] {
  const onlyUpcoming = opts.onlyUpcoming ?? true;
  const withStats: Ranked[] = activities.map((a) => ({
    ...a,
    stats: a.key ? clicks.get(a.key) ?? null : null,
    upcoming: isUpcoming(a.parsed, opts.today),
    rank: null,
  }));

  const firstDate = (a: Ranked) => (a.parsed?.dates[0] ? dayNumber(a.parsed.dates[0]) : Infinity);
  const eligible = withStats
    .filter((a) => a.stats) // no link, or no clicks recorded: cannot be ranked
    .filter((a) => !(onlyUpcoming && a.upcoming === false))
    .filter((a) => !(opts.dropUndated && a.upcoming === null))
    .sort(
      (a, b) =>
        b.stats!.score - a.stats!.score || // 1. unique verified clickers
        b.stats!.totalVerified - a.stats!.totalVerified || // 2. total verified clicks
        firstDate(a) - firstDate(b) || // 3. sooner first
        a.id - b.id, // 4. newsletter order
    );
  eligible.forEach((a, i) => (a.rank = i + 1));
  return withStats;
}

/** Click rows whose link is not any activity's link (stories, footer, archive...). Useful as a diagnostic. */
export function unmatchedClicks(activities: Activity[], clicks: Map<string, LinkStats>): LinkStats[] {
  const keys = new Set(activities.flatMap((a) => (a.key ? [a.key] : [])));
  return [...clicks.values()].filter((s) => !keys.has(s.key)).sort((a, b) => b.score - a.score);
}

/**
 * Finds a link's click stats. An exact match on the normalized link comes first. Failing that, a link with no query string
 * matches a clicked link that only differs by its query string (or the other way round), when that is the only candidate:
 * email tools add parameters to the link in one place and not the other. Two links that both have query strings never match
 * loosely, since "event?id=1" and "event?id=2" are different pages.
 */
export function clickLookup(clicks: Map<string, LinkStats>): (key: string) => { stats: LinkStats; loose: boolean } | null {
  const byLoose = new Map<string, LinkStats[]>();
  for (const s of clicks.values()) {
    const k = looseKey(s.key);
    const list = byLoose.get(k);
    if (list) list.push(s);
    else byLoose.set(k, [s]);
  }
  return (key) => {
    const exact = clicks.get(key);
    if (exact) return { stats: exact, loose: false };
    const group = byLoose.get(looseKey(key));
    if (group?.length === 1 && (!key.includes("?") || !group[0].key.includes("?"))) return { stats: group[0], loose: true };
    return null;
  };
}
