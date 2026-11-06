import type { ParsedDate } from "./types";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const validDate = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

/** Calendar-day arithmetic on YYYY-MM-DD strings (no timezone involved). */
export function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}
/** YYYY-MM-DD plus `n` days. */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return isoOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
/** 0 = Sunday. */
const weekdayOf = (iso: string) => new Date(dayNumber(iso) * 86400000).getUTCDay();

const MON = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const WD = "sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:s|nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?";
const D = (n: string) => `(?<${n}>\\d{1,2})(?:st|nd|rd|th)?`;
const M = (n: string) => `(?<${n}>${MON})(?![a-z])\\.?`;
const Y = `(?:,?\\s+(?<y>\\d{4}))?`;
const JOIN = `(?:\\s*[-–—]\\s*|\\s+(?:to|through|thru|until|till)\\s+)`;
/** A day number is not the start of a time ("Oct 26 9:30") or a time itself ("Oct 9 am"). */
const NOT_TIME = `(?![\\d:])(?!\\s*(?:am|pm|a\\.m|p\\.m)\\b)`;
const START = `(?<![\\d:.])`;

const monthNum = (token: string) => MONTHS.indexOf(token.slice(0, 3).toLowerCase()) + 1;
/** "May" the verb ("up to 6 may come") is not a date: the month has to be capitalized. */
const monthOk = (token: string | undefined) => !token || token.toLowerCase() !== "may" || /^M/.test(token);

type Span = { at: number; end: number; dates: string[] };
type Resolver = (g: Record<string, string | undefined>, ctx: Ctx, at: number) => string[] | null;
type Ctx = { text: string; reference: string; numeric?: "mdy" | "dmy" };

/** The year that puts a month and day nearest the issue date (an event is never announced a year ahead or behind). */
function resolveDay(m: number, d: number, ctx: Ctx, year?: number): string | null {
  if (year !== undefined) return validDate(year, m, d) ? isoOf(year, m, d) : null;
  const refYear = Number(ctx.reference.slice(0, 4));
  const near = [refYear - 1, refYear, refYear + 1]
    .filter((y) => validDate(y, m, d))
    .map((y) => isoOf(y, m, d))
    .sort((a, b) => Math.abs(dayNumber(a) - dayNumber(ctx.reference)) - Math.abs(dayNumber(b) - dayNumber(ctx.reference)));
  return near[0] ?? null;
}

const yearOf = (y: string | undefined) => (y ? Number(y) : undefined);

/** The end of a range lands in the next year when it comes before the start ("30 Dec - 2 Jan"). */
function endAfter(start: string, m: number, d: number, ctx: Ctx, year?: number): string | null {
  const y0 = Number(start.slice(0, 4));
  for (const y of year !== undefined ? [year] : [y0, y0 + 1]) {
    if (validDate(y, m, d) && dayNumber(isoOf(y, m, d)) >= dayNumber(start)) return isoOf(y, m, d);
  }
  return null;
}

function twoMonths(g: Record<string, string | undefined>, ctx: Ctx): string[] | null {
  if (!monthOk(g.m1) || !monthOk(g.m2)) return null;
  const start = resolveDay(monthNum(g.m1!), Number(g.d1), ctx, yearOf(g.y));
  const end = start && endAfter(start, monthNum(g.m2!), Number(g.d2), ctx, yearOf(g.y));
  return start && end ? [start, end] : null;
}
function oneMonthRange(g: Record<string, string | undefined>, ctx: Ctx): string[] | null {
  if (!monthOk(g.m1)) return null;
  const m = monthNum(g.m1!);
  const start = resolveDay(m, Number(g.d1), ctx, yearOf(g.y));
  const end = start && endAfter(start, m, Number(g.d2), ctx, yearOf(g.y));
  return start && end ? [start, end] : null;
}
const single: Resolver = (g, ctx) => {
  if (!monthOk(g.m1)) return null;
  const day = resolveDay(monthNum(g.m1!), Number(g.d1), ctx, yearOf(g.y));
  return day ? [day] : null;
};

/** 10/26/2026, 26/10/2026, 26.10.2026: a part above 12 is the day; otherwise `numeric` says which comes first, else it is skipped. */
const numericYear: Resolver = (g, ctx) => {
  const a = Number(g.a), b = Number(g.b);
  const y = g.y!.length === 2 ? 2000 + Number(g.y) : Number(g.y);
  const order = a > 12 ? "dmy" : b > 12 ? "mdy" : a === b ? "mdy" : ctx.numeric;
  if (!order) return null;
  const day = order === "dmy" ? resolveDay(b, a, ctx, y) : resolveDay(a, b, ctx, y);
  return day ? [day] : null;
};
/** "Sat 10/26": the weekday settles which way round it is. */
const numericWeekday: Resolver = (g, ctx, at) => {
  const hint = WEEKDAYS.indexOf(ctx.text.slice(at, at + 3).toLowerCase());
  const a = Number(g.a), b = Number(g.b);
  for (const [m, d] of a > 12 ? [[b, a]] : b > 12 ? [[a, b]] : ctx.numeric === "dmy" ? [[b, a], [a, b]] : [[a, b], [b, a]]) {
    const day = resolveDay(m, d, ctx);
    if (day && weekdayOf(day) === hint) return [day];
  }
  return null;
};

const PATTERNS: [RegExp, Resolver][] = [
  [new RegExp(`\\b(?<y>\\d{4})-(?<m>\\d{2})-(?<d>\\d{2})\\b`, "gi"), (g, ctx) => {
    const day = resolveDay(Number(g.m), Number(g.d), ctx, Number(g.y));
    return day ? [day] : null;
  }],
  // 26 Oct - 2 Nov
  [new RegExp(`${START}${D("d1")}\\s+${M("m1")}${JOIN}${D("d2")}\\s+${M("m2")}${Y}`, "gi"), twoMonths],
  // Oct 26 - Nov 2
  [new RegExp(`\\b${M("m1")}\\s+${D("d1")}${JOIN}${M("m2")}\\s+${D("d2")}${NOT_TIME}${Y}`, "gi"), twoMonths],
  // 26-28 Oct
  [new RegExp(`${START}${D("d1")}${JOIN}${D("d2")}\\s+(?:of\\s+)?${M("m1")}${Y}`, "gi"), oneMonthRange],
  // Oct 26-28
  [new RegExp(`\\b${M("m1")}\\s+${D("d1")}${JOIN}${D("d2")}${NOT_TIME}${Y}`, "gi"), oneMonthRange],
  // 26 Oct, 26th of October 2026
  [new RegExp(`${START}${D("d1")}\\s+(?:of\\s+)?${M("m1")}${Y}`, "gi"), single],
  // Oct 26, October 26th, 2026
  [new RegExp(`\\b${M("m1")}\\s+${D("d1")}${NOT_TIME}${Y}`, "gi"), single],
  [new RegExp(`(?<![\\d/.])(?<a>\\d{1,2})[/.](?<b>\\d{1,2})[/.](?<y>\\d{4})(?![\\d/.])`, "g"), numericYear],
  [new RegExp(`(?<![\\d/.])(?<a>\\d{1,2})/(?<b>\\d{1,2})/(?<y>\\d{2})(?![\\d/])`, "g"), numericYear],
  [new RegExp(`\\b(?:${WD})\\.?,?\\s+(?<a>\\d{1,2})/(?<b>\\d{1,2})(?![\\d/])`, "gi"), numericWeekday],
];

const MER = "am|pm|a\\.m\\.?|p\\.m\\.?";
const to24 = (h: number, min: number, mer?: string) => {
  if (mer) {
    const pm = mer[0].toLowerCase() === "p";
    h = h === 12 ? (pm ? 12 : 0) : pm ? h + 12 : h;
  }
  return h <= 23 && min <= 59 ? `${pad(h)}:${pad(min)}` : null;
};

/** Clock times in `text` (date words already blanked out): a range ("9-11am", "9:30-12:30") or one time ("7pm", "19:30", "noon"). */
function parseTimes(text: string): { startTime?: string; endTime?: string } {
  const range = new RegExp(
    `(?<![\\d:.])(?<h1>\\d{1,2})(?::(?<n1>\\d{2}))?\\s*(?<m1>${MER})?\\s*(?:[-–—]|\\bto\\b|\\buntil\\b|\\btill\\b)\\s*(?<h2>\\d{1,2})(?::(?<n2>\\d{2}))?\\s*(?<m2>${MER})?(?![\\d:a-z])`,
    "gi",
  );
  for (const m of text.matchAll(range)) {
    const g = m.groups!;
    if (!(g.n1 || g.m1 || g.n2 || g.m2)) continue; // "10-12 years", "0-3": not times
    const h1 = Number(g.h1), h2 = Number(g.h2);
    let m1 = g.m1;
    if (!m1 && g.m2) m1 = h1 !== 12 && h1 > h2 ? (g.m2[0].toLowerCase() === "p" ? "am" : "pm") : g.m2;
    const start = to24(h1, Number(g.n1 ?? 0), m1);
    const end = to24(h2, Number(g.n2 ?? 0), g.m2 ?? (g.m1 && h2 > h1 ? g.m1 : undefined));
    if (start && end) return { startTime: start, endTime: end };
  }
  const one = new RegExp(`(?<![\\d:.])(?:(?<h>\\d{1,2}):(?<n>\\d{2})\\s*(?<mer>${MER})?(?![\\d:])|(?<h2>\\d{1,2})\\s*(?<mer2>${MER})(?![a-z]))`, "gi");
  const times: string[] = [];
  for (const m of text.matchAll(one)) {
    const g = m.groups!;
    const t = g.h ? to24(Number(g.h), Number(g.n), g.mer) : to24(Number(g.h2), 0, g.mer2);
    if (t) times.push(t);
  }
  if (times.length === 0) {
    if (/\bmidnight\b/i.test(text)) times.push("00:00");
    else if (/\b(noon|midday)\b/i.test(text)) times.push("12:00");
  }
  return { startTime: times[0], endTime: times[1] };
}

export type ParseWhenOptions = {
  /** For running text rather than a date line: a bare weekday ("Saturday") is not taken as a date, only a written-out one. */
  loose?: boolean;
  /** Which way round "10/5" is read when it could be either. Without it, an ambiguous numeric date is skipped. */
  numeric?: "mdy" | "dmy";
};

const RECURRING = new RegExp(`\\b(weekly|bi-?weekly|fortnightly|monthly|daily|every|each|ongoing|drop-?in|starting|starts|begins|beginning|(?:sun|mon|tues|wednes|thurs|fri|satur)days)\\b`, "i");
const ENDS = /\b(until|till|through|thru|ends?|ending|closes?|closing|last day)\W{0,3}$/i;

/**
 * Parses the human date line of an activity. Formats vary per newsletter, so this only extracts what it can find:
 * every date ("26 Oct", "Oct 26th", "Sat, Oct 26 2026", "26-28 Oct", "Oct 26 - Nov 2", "2026-10-26", "10/26/2026", "Sat 10/26"),
 * a bare weekday on a date line ("Fri 7:30pm": the next one from the issue date), the first clock time or time range ("9:30", "7pm", "9-11am", "noon"),
 * whether it recurs ("Weekly", "Every Tuesday", "Saturdays", "Starting 23 Oct"), and whether the date is an end ("Until 30 Nov").
 * `reference` (YYYY-MM-DD) is the issue's publish date, used to pick the year and to resolve a bare weekday. Relative words ("tomorrow", "this weekend", "next Friday") are deliberately not read.
 */
export function parseWhen(when: string, reference: string, opts: ParseWhenOptions = {}): ParsedDate | null {
  const ctx: Ctx = { text: when, reference, numeric: opts.numeric };
  const spans: Span[] = [];
  const overlaps = (at: number, end: number) => spans.some((s) => at < s.end && end > s.at);
  for (const [re, resolve] of PATTERNS) {
    for (const m of when.matchAll(re)) {
      const at = m.index!, end = at + m[0].length;
      if (overlaps(at, end)) continue;
      const dates = resolve(m.groups ?? {}, ctx, at);
      if (dates) spans.push({ at, end, dates });
    }
  }
  spans.sort((a, b) => a.at - b.at);
  let dates = spans.flatMap((s) => s.dates);
  let inferred = false;
  let recurring = RECURRING.test(when);

  if (dates.length === 0) {
    const words: { at: number; dates: string[] }[] = [];
    // Only on a date line (running text never reaches this): a bare weekday ("Fri 7:30pm", a "Friday" subheading) is the next such day
    // from the issue date. Relative words ("tomorrow", "this weekend", "next Friday") are not read: they cause more trouble than they save.
    if (!opts.loose)
      for (const m of when.matchAll(new RegExp(`(?<!\\b(?:this|next|last|coming|following)\\s)\\b(?:(?<mod>every|each)\\s+)?(?<wd>${WD})(?<pl>s)?\\b`, "gi"))) {
        const mod = m.groups!.mod?.toLowerCase();
        const wd = WEEKDAYS.indexOf(m.groups!.wd.slice(0, 3).toLowerCase());
        const day = addDays(reference, (wd - weekdayOf(reference) + 7) % 7);
        if (mod || m.groups!.pl) recurring = true;
        words.push({ at: m.index!, dates: [day] });
      }
    words.sort((a, b) => a.at - b.at);
    dates = words.flatMap((w) => w.dates);
    inferred = dates.length > 0;
    if (inferred) spans.push(...words.map((w) => ({ at: w.at, end: w.at, dates: w.dates })));
  }
  dates = dates.filter((d, i) => dates.indexOf(d) === i);
  if (dates.length === 0) return null;

  // "Until Nov 30": the date is where it ends.
  const first = spans[0];
  const ends = !inferred && spans.length === 1 && first.dates.length === 1 && ENDS.test(when.slice(Math.max(0, first.at - 14), first.at));

  let rest = when;
  for (const s of spans) rest = rest.slice(0, s.at) + " ".repeat(s.end - s.at) + rest.slice(s.end);
  const { startTime, endTime } = parseTimes(rest);
  const out: ParsedDate = { dates, recurring: ends ? false : recurring, startTime, at: first.at };
  if (endTime) out.endTime = endTime;
  if (ends) out.ends = true;
  if (inferred) out.inferred = true;
  return out;
}

/** Is any occurrence still ahead (or ongoing)? `today` is YYYY-MM-DD. Undated activities return null. */
export function isUpcoming(p: ParsedDate | null, today: string): boolean | null {
  if (!p) return null;
  if (p.recurring) return true;
  const ahead = p.dates.some((d) => dayNumber(d) >= dayNumber(today));
  return p.soft && !ahead ? null : ahead;
}

/** Words just before a date that say it is not when the event happens: a deadline, a back-reference, an end. */
const NOT_THE_EVENT = /\b(clos(?:e|es|ed|ing)|ends?|ended|since|last|was|were|posted|published|updated|deadline|expired?|launched|opened|founded|born|ago|by|before|after|previous|earlier)\b/i;
/** Words just before a date that say it is when the event happens. */
const THE_EVENT = /\b(on|at|join us|joins?|starts?|starting|begins?|takes? place|happening|held|from|until|through|when|date|kicks off|returns?)\W*$/i;
const WEEKDAY_BEFORE = new RegExp(`\\b(?:${WD})\\.?,?\\s*$`, "i");
/** More than this many days from the issue date is not an upcoming event, it is a year in the past or the future. */
const TOO_FAR = 400;

/**
 * Finds the date an event happens in a piece of running text. Sentence by sentence, the first date that is not a deadline or a
 * back-reference ("registration closed Oct 3", "founded last March") counts. With `requireCue` (for text where a date could be anywhere) a date
 * must also come with a sign that it is the event's: a weekday ("Sat, Oct 24"), a time ("Oct 24 at 7pm"), a word like "on", "join us",
 * or "starts".
 */
export function findEventDate(text: string, reference: string, opts: { requireCue?: boolean; numeric?: ParseWhenOptions["numeric"] } = {}): ParsedDate | null {
  for (const sentence of text.split(/(?<=[.!?])\s+(?=[A-Z"“(])/)) {
    const p = parseWhen(sentence, reference, { loose: true, numeric: opts.numeric });
    if (!p || p.at === undefined) continue;
    if (p.dates.some((d) => Math.abs(dayNumber(d) - dayNumber(reference)) > TOO_FAR)) continue;
    if (NOT_THE_EVENT.test(sentence.slice(Math.max(0, p.at - 32), p.at))) continue;
    if (opts.requireCue) {
      const cue = p.startTime || p.inferred || WEEKDAY_BEFORE.test(sentence.slice(Math.max(0, p.at - 14), p.at)) || THE_EVENT.test(sentence.slice(Math.max(0, p.at - 24), p.at));
      if (!cue) continue;
    }
    return p;
  }
  return null;
}
