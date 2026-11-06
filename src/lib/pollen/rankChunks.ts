import type { Chunk } from "./chunks";
import { dayNumber, findEventDate, isUpcoming, parseWhen, type ParseWhenOptions } from "./dates";
import { clickLookup } from "./rank";
import type { LinkStats, ParsedDate } from "./types";

/**
 * Ranks the chunks of any issue by what readers clicked, whatever its layout. (The older rankActivities only understood
 * the one layout with an "activities" heading and bulleted dated items.)
 *
 *  1. A chunk is a candidate when it has a link that the click data lists, and the link isn't boilerplate (unsubscribe,
 *     "manage preferences", a sponsor block, the publication's own subscribe link...).
 *  2. Scope: sections headed like an event list ("What's happening", "Events", "Things to do"...) with at least two candidates, and any
 *     section where at least two candidates have a date, are what counts. If there are none of those (a link roundup), every candidate does.
 *     So a feature story or a sponsor with more clicks than any event doesn't take the top spot of an events list.
 *  3. Items whose dates are all past are dropped (items without a date are kept).
 *  4. Order: unique verified clickers, then total verified clicks, then the sooner date, then the issue's own order.
 */

const EVENT_HEADING = /happening|\bevents?\b|activities|things to do|what'?s on|this week|weekend|calendar|agenda|upcoming|out and about|goings[- ]on/i;
const BOILERPLATE_URL =
  /unsubscribe|manage[-_ ]?(?:your[-_ ])?(?:subscription|preferences)|email[-_]?preferences|view[-_]in[-_]browser|\/(?:subscribe|upgrade|refer|share|preferences)(?:[/?]|$)|\/archive\/?$|privacy|\/terms|^https:\/\/[^/]*beehiiv\.com\/?$/i;
const BOILERPLATE_TITLE = /^(unsubscribe|manage (?:your )?(?:subscription|preferences)|view (?:it )?in (?:your )?browser|read online|subscribe|forward|share|refer|advertise|upgrade|privacy|terms)\b/i;
const SPONSOR_SECTION = /^(?:sponsor|advert|partner message|presented by|brought to you|a message from|together with|today'?s sponsor|ad\b|promoted)/i;

export type ChunkStatus = "ranked" | "no link" | "no clicks" | "boilerplate" | "out of scope" | "past";
export type ChunkAnalysis = {
  chunk: Chunk;
  status: ChunkStatus;
  rank: number | null;
  stats: LinkStats | null;
  /** Dates read from the chunk's date line, or failing that from the first words of its text. */
  parsed: ParsedDate | null;
  /** Matched to the click data by host and path only (the query strings differ). */
  loose: boolean;
  upcoming: boolean | null;
};

export type RankChunksOptions = {
  /** YYYY-MM-DD: today. */
  today: string;
  /** YYYY-MM-DD: the issue's publish date, used to read years and bare weekdays. */
  reference: string;
  /** Drop items whose dates are all past (default true). */
  onlyUpcoming?: boolean;
  numeric?: ParseWhenOptions["numeric"];
};

/** How much text at each end of a chunk is searched for a date without needing a cue. */
const EDGE = 160;

/**
 * A chunk's dates: its date line if it has one; else a date at the start of its text, or at the end (not a deadline or a back-reference);
 * else one in the middle that comes with a sign it is the event's (a weekday, a time, "on", "join us"...). A date found in the middle is `soft`:
 * it orders the pick in a caption but never makes the ranking call it over.
 */
export function chunkDates(c: Chunk, reference: string, numeric?: ParseWhenOptions["numeric"]): ParsedDate | null {
  if (c.when) {
    const p = parseWhen(c.when, reference, { numeric });
    if (p) return p;
  }
  const head = findEventDate(c.text.slice(0, EDGE), reference, { numeric });
  if (head) return head;
  if (c.text.length > EDGE) {
    const tail = findEventDate(c.text.slice(-EDGE), reference, { numeric });
    if (tail) return tail;
  }
  const middle = findEventDate(c.text, reference, { requireCue: true, numeric });
  return middle ? { ...middle, soft: true } : null;
}

const isBoilerplate = (c: Chunk) =>
  !c.key || BOILERPLATE_URL.test(c.key) || BOILERPLATE_TITLE.test(c.title) || SPONSOR_SECTION.test(c.section) || SPONSOR_SECTION.test(c.topic ?? "");

export function analyzeChunks(chunks: Chunk[], clicks: Map<string, LinkStats>, opts: RankChunksOptions): ChunkAnalysis[] {
  const find = clickLookup(clicks);
  const onlyUpcoming = opts.onlyUpcoming ?? true;
  const all: ChunkAnalysis[] = chunks.map((chunk) => {
    const parsed = chunkDates(chunk, opts.reference, opts.numeric);
    const hit = chunk.key ? find(chunk.key) : null;
    const status: ChunkStatus = !chunk.key ? "no link" : isBoilerplate(chunk) ? "boilerplate" : !hit ? "no clicks" : "ranked";
    return { chunk, status, rank: null, stats: hit?.stats ?? null, parsed, loose: hit?.loose ?? false, upcoming: isUpcoming(parsed, opts.today) };
  });

  // The same link twice in an issue (a "Quick Picks" line, then the full entry): the one with a date is the candidate, else the first.
  const winner = new Map<string, ChunkAnalysis>();
  for (const a of all) {
    if (a.status !== "ranked") continue;
    const w = winner.get(a.chunk.key!);
    if (!w || (!w.parsed && a.parsed)) winner.set(a.chunk.key!, a);
  }
  for (const a of all) if (a.status === "ranked" && winner.get(a.chunk.key!) !== a) a.status = "out of scope";

  const cands = all.filter((a) => a.status === "ranked");
  const sections = new Map<string, ChunkAnalysis[]>();
  for (const a of cands) sections.set(a.chunk.section, [...(sections.get(a.chunk.section) ?? []), a]);
  const union = (keep: (name: string, list: ChunkAnalysis[]) => boolean) => new Set([...sections].filter(([n, l]) => keep(n, l)).flatMap(([, l]) => l));
  // Sections headed like an event list, plus any other section with at least two dated items ("Later this month").
  let scope = union((n, l) => (EVENT_HEADING.test(n) && l.length >= 2) || l.filter((a) => a.parsed).length >= 2);
  if (scope.size === 0) scope = new Set(cands);
  for (const a of cands) if (!scope.has(a)) a.status = "out of scope";

  for (const a of cands) if (a.status === "ranked" && onlyUpcoming && a.upcoming === false) a.status = "past";

  const firstDate = (a: ChunkAnalysis) => (a.parsed?.dates[0] ? dayNumber(a.parsed.dates[0]) : Infinity);
  all
    .filter((a) => a.status === "ranked")
    .sort(
      (a, b) =>
        b.stats!.score - a.stats!.score || // 1. unique verified clickers
        b.stats!.totalVerified - a.stats!.totalVerified || // 2. total verified clicks
        firstDate(a) - firstDate(b) || // 3. sooner first
        a.chunk.id - b.chunk.id, // 4. issue order
    )
    .forEach((a, i) => (a.rank = i + 1));
  return all;
}

/** chunk id -> rank and score, for the chunks that are ranked. */
export function rankChunks(chunks: Chunk[], clicks: Map<string, LinkStats>, opts: RankChunksOptions): Map<number, { rank: number; score: number }> {
  return new Map(analyzeChunks(chunks, clicks, opts).filter((a) => a.rank).map((a) => [a.chunk.id, { rank: a.rank!, score: a.stats!.score }]));
}

const WD3 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (iso: string) => {
  const d = new Date(dayNumber(iso) * 86400000);
  return `${WD3[d.getUTCDay()]} ${d.getUTCDate()} ${MO3[d.getUTCMonth()]}`;
};

/** A date read from text, written like a newsletter's own date line: "Sat 21 Nov @ 19:00", "Sat 7 Nov - Sun 8 Nov", "Until Sat 21 Nov". A recurrence has no short form, so it gets none. */
export function dateLine(p: ParsedDate): string | null {
  if (p.recurring || p.dates.length === 0) return null;
  const first = label(p.dates[0]);
  const last = p.dates.length > 1 ? label(p.dates[p.dates.length - 1]) : null;
  const day = last ? `${first} - ${last}` : first;
  const time = p.startTime ? ` @ ${p.startTime}${p.endTime ? `-${p.endTime}` : ""}` : "";
  return p.ends ? `Until ${day}` : `${day}${time}`;
}

/**
 * Gives a chunk with no date line the date found in its text (see chunkDates), so slides and captions show it. Chunks that
 * have a date line are untouched. Call it after ranking: ranking must see which dates were read from running text.
 */
export function withDates<T extends Chunk>(chunks: T[], reference: string, numeric?: ParseWhenOptions["numeric"]): T[] {
  return chunks.map((c) => {
    if (c.when) return c;
    const p = chunkDates(c, reference, numeric);
    const when = p ? dateLine(p) : null;
    return when ? { ...c, when } : c;
  });
}
