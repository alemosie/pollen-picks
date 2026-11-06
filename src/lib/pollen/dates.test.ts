import assert from "node:assert/strict";
import { test } from "node:test";
import { findEventDate, isUpcoming, parseWhen } from "./dates";

// Mon 19 Oct 2026 is the issue date in most cases below.
const REF = "2026-10-19";
const w = (s: string, ref = REF, o?: Parameters<typeof parseWhen>[2]) => parseWhen(s, ref, o);
const dates = (s: string, ref = REF, o?: Parameters<typeof parseWhen>[2]) => w(s, ref, o)?.dates;

test("the format the newsletter uses today", () => {
  assert.deepEqual(w("Mon 26 Oct @ 9:30-12:30"), { dates: ["2026-10-26"], recurring: false, startTime: "09:30", endTime: "12:30", at: 4 });
  assert.deepEqual(dates("Thu 22 Oct @ 09:30-10:30 (Weekly)"), ["2026-10-22"]);
  assert.equal(w("Thu 22 Oct @ 09:30-10:30 (Weekly)")?.recurring, true);
  assert.equal(w("Starts 20 Oct")?.recurring, true);
  assert.equal(w("Wed starting 28 Oct")?.recurring, true);
});

test("month first, ordinals, weekday and year", () => {
  assert.deepEqual(dates("Sat, Oct 24"), ["2026-10-24"]);
  assert.deepEqual(dates("Saturday, October 24th, 2026"), ["2026-10-24"]);
  assert.deepEqual(dates("Oct. 3rd"), ["2026-10-03"]);
  assert.deepEqual(dates("Sept 5"), ["2026-09-05"]);
  assert.deepEqual(dates("24th of October"), ["2026-10-24"]);
  assert.deepEqual(dates("Oct 24 or Oct 31"), ["2026-10-24", "2026-10-31"]);
});

test("ranges, with the year rolling over", () => {
  assert.deepEqual(dates("Oct 24-25"), ["2026-10-24", "2026-10-25"]);
  assert.deepEqual(dates("24–25 Oct"), ["2026-10-24", "2026-10-25"]);
  assert.deepEqual(dates("Oct 30 - Nov 2"), ["2026-10-30", "2026-11-02"]);
  assert.deepEqual(dates("30 Oct to 2 Nov"), ["2026-10-30", "2026-11-02"]);
  assert.deepEqual(dates("30 Dec - 2 Jan", "2026-12-20"), ["2026-12-30", "2027-01-02"]);
});

test("numeric dates only when they are unambiguous", () => {
  assert.deepEqual(dates("2026-10-24"), ["2026-10-24"]);
  assert.deepEqual(dates("10/24/2026"), ["2026-10-24"]);
  assert.deepEqual(dates("24/10/2026"), ["2026-10-24"]);
  assert.deepEqual(dates("24.10.2026"), ["2026-10-24"]);
  assert.equal(dates("5/10/2026"), undefined);
  assert.deepEqual(dates("5/10/2026", REF, { numeric: "dmy" }), ["2026-10-05"]);
  assert.deepEqual(dates("5/10/2026", REF, { numeric: "mdy" }), ["2026-05-10"]);
  assert.deepEqual(dates("Sat 10/24"), ["2026-10-24"]);
  assert.equal(dates("open 24/7"), undefined);
});

test("times", () => {
  assert.deepEqual([w("Oct 24, 9-11am")?.startTime, w("Oct 24, 9-11am")?.endTime], ["09:00", "11:00"]);
  assert.deepEqual([w("Oct 24 11-1pm")?.startTime, w("Oct 24 11-1pm")?.endTime], ["11:00", "13:00"]);
  assert.deepEqual([w("Oct 24 12-2pm")?.startTime, w("Oct 24 12-2pm")?.endTime], ["12:00", "14:00"]);
  assert.equal(w("Oct 24, 7:30 PM")?.startTime, "19:30");
  assert.equal(w("Oct 24 at 7pm")?.startTime, "19:00");
  assert.equal(w("Oct 24 noon")?.startTime, "12:00");
  assert.equal(w("9:30 Oct 4", "2026-10-01")?.startTime, "09:30");
  assert.deepEqual(dates("9:30 Oct 4", "2026-10-01"), ["2026-10-04"]);
  assert.equal(w("Oct 24, ages 10-12")?.startTime, undefined);
  assert.equal(w("Oct 24 (0-3 years)")?.startTime, undefined);
});

test("recurrence and end dates", () => {
  const every = w("Every Tuesday at 10am");
  assert.deepEqual([every?.dates, every?.recurring, every?.startTime, every?.inferred], [["2026-10-20"], true, "10:00", true]);
  assert.equal(w("Saturdays 9:30")?.recurring, true);
  const until = w("Until Nov 30");
  assert.deepEqual([until?.dates, until?.ends, until?.recurring], [["2026-11-30"], true, false]);
  assert.equal(w("Through Oct 31")?.ends, true);
  assert.equal(w("Weekly"), null);
});

test("a bare weekday on a date line is the next one; relative words are not read", () => {
  assert.deepEqual(dates("Sat 9:30"), ["2026-10-24"]);
  assert.equal(w("Sat 9:30")?.inferred, true);
  for (const text of ["Tomorrow at 6pm", "this Saturday", "next Friday", "this weekend", "tonight", "today"]) assert.equal(dates(text), undefined, text);
});

test("running text is stricter", () => {
  const loose = { loose: true };
  assert.equal(dates("Join us on Saturday for", REF, loose), undefined);
  assert.equal(dates("Saturday's game was great", REF, loose), undefined);
  assert.equal(dates("Today we celebrate", REF, loose), undefined);
  assert.equal(dates("Join us tomorrow", REF, loose), undefined);
  assert.deepEqual(dates("Join us on Sat 24 Oct for", REF, loose), ["2026-10-24"]);
});

test("things that look like dates but are not", () => {
  assert.equal(dates("up to 6 may attend"), undefined);
  assert.deepEqual(dates("6 May", "2026-04-20"), ["2026-05-06"]);
  assert.equal(dates("Feb 30"), undefined);
  assert.equal(dates("founded in October 2019"), undefined);
  assert.equal(dates("Octopus 26"), undefined);
});

test("the year nearest the issue wins, even when the weekday is wrong", () => {
  // 28 Oct 2026 is a Wednesday, so "Tue 28 Oct" is a typo in the newsletter, not a hint at 2025.
  assert.deepEqual(dates("Tue 28 Oct @ 19:00"), ["2026-10-28"]);
  assert.deepEqual(dates("Sat 26 Oct", "2024-10-21"), ["2024-10-26"]);
});

test("isUpcoming", () => {
  assert.equal(isUpcoming(w("Mon 26 Oct"), "2026-10-21"), true);
  assert.equal(isUpcoming(w("Mon 19 Oct"), "2026-10-21"), false);
  assert.equal(isUpcoming(w("Oct 20-23"), "2026-10-21"), true);
  assert.equal(isUpcoming(w("Weekly from 1 Oct"), "2026-10-21"), true);
  assert.equal(isUpcoming(w("Until Oct 20"), "2026-10-21"), false);
  assert.equal(isUpcoming(null, "2026-10-21"), null);
});

test("a soft date is never a reason to call an item over", () => {
  const soft = { ...parseWhen("Oct 10", REF)!, soft: true };
  assert.equal(isUpcoming(soft, "2026-10-21"), null);
  assert.equal(isUpcoming({ ...parseWhen("Oct 30", REF)!, soft: true }, "2026-10-21"), true);
});

test("findEventDate: first sentence with an event date wins", () => {
  assert.deepEqual(findEventDate("Registration closed Oct 3. Join us on Oct 24!", REF)?.dates, ["2026-10-24"]);
  assert.equal(findEventDate("We love Oct 24.", REF, { requireCue: true }), null);
  assert.deepEqual(findEventDate("We love Oct 24.", REF)?.dates, ["2026-10-24"]);
  assert.deepEqual(findEventDate("The class starts Oct. 24 and runs weekly.", REF)?.dates, ["2026-10-24"]);
});

test("abbreviations like Tues, Weds and Thurs are weekdays, not plurals (so not 'every Tuesday')", () => {
  for (const [text, day] of [["Tues 11th Nov", "2026-11-11"], ["Weds 11 Nov", "2026-11-11"], ["Thurs 12 Nov", "2026-11-12"]] as const) {
    const p = parseWhen(text, "2026-11-06")!;
    assert.deepEqual([p.dates, p.recurring], [[day], false], text);
  }
  assert.equal(parseWhen("Tuesdays at 10am", "2026-11-06")!.recurring, true);
});

test("a date after 'returns next week,' is read, even with a weekday that doesn't match the date", () => {
  const t = "The flagship conference, The Future of Knowledge returns next week, Tues 11th Nov for another all-dayer around King\u2019s Cross.";
  const p = findEventDate(t, "2026-11-06", { requireCue: true })!;
  assert.deepEqual([p.dates, p.recurring], [["2026-11-11"], false]);
});
