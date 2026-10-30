import type { ParsedDate } from "./types";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DATE_RE = /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi;

const pad = (n: number) => String(n).padStart(2, "0");

/** Calendar-day arithmetic on YYYY-MM-DD strings (no timezone involved). */
export function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/**
 * Parses the human date line of an activity. Formats vary per newsletter, so this only extracts
 * what it can find: every "26 Oct"-style date, the first clock time, and whether it recurs.
 * `reference` (YYYY-MM-DD) is the issue's publish date, used to pick the year.
 */
export function parseWhen(when: string, reference: string): ParsedDate | null {
  const dates: string[] = [];
  for (const m of when.matchAll(DATE_RE)) {
    const day = Number(m[1]);
    const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
    const refYear = Number(reference.slice(0, 4));
    // Choose the year that puts the date closest to the issue date (handles Dec -> Jan issues).
    const best = [refYear - 1, refYear, refYear + 1]
      .map((y) => `${y}-${pad(month)}-${pad(day)}`)
      .sort((a, b) => Math.abs(dayNumber(a) - dayNumber(reference)) - Math.abs(dayNumber(b) - dayNumber(reference)))[0];
    dates.push(best);
  }
  if (dates.length === 0) return null;
  const time = when.match(/\b(\d{1,2}):(\d{2})\b/);
  return {
    dates,
    recurring: /\b(weekly|starting|starts|every)\b/i.test(when),
    startTime: time ? `${pad(Number(time[1]))}:${time[2]}` : undefined,
  };
}

/** Is any occurrence still ahead (or ongoing)? `today` is YYYY-MM-DD. Undated activities return null. */
export function isUpcoming(p: ParsedDate | null, today: string): boolean | null {
  if (!p) return null;
  if (p.recurring) return true;
  return p.dates.some((d) => dayNumber(d) >= dayNumber(today));
}
