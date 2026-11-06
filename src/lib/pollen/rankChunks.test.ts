import assert from "node:assert/strict";
import { test } from "node:test";
import type { Chunk } from "./chunks";
import { chunkDates } from "./rankChunks";

const REF = "2026-10-19";
const chunk = (text: string, when: string | null = null): Chunk => ({ id: 1, section: "s", kind: "paragraph", title: text.slice(0, 20), body: "", text, when, place: null, blurb: "", url: null, key: null });
const filler = "A long description of the event that goes on for a while and says nothing about when it happens. ".repeat(4);

test("a date line wins", () => {
  assert.deepEqual(chunkDates(chunk("Whatever Oct 30", "Sat 24 Oct"), REF)?.dates, ["2026-10-24"]);
});
test("a date at the start or at the end of the text is found", () => {
  assert.deepEqual(chunkDates(chunk(`Sat, Oct 24 · 9-11am. ${filler}`), REF)?.dates, ["2026-10-24"]);
  assert.deepEqual(chunkDates(chunk(`${filler} Join us on Oct 31 at 6pm`), REF)?.dates, ["2026-10-31"]);
});
test("a date in the middle needs a sign it is the event's", () => {
  assert.deepEqual(chunkDates(chunk(`${filler} Meet on Oct 24 at the gate. ${filler}`), REF)?.dates, ["2026-10-24"]);
  assert.deepEqual(chunkDates(chunk(`${filler} The fair is Sat, Oct 24 in the park. ${filler}`), REF)?.dates, ["2026-10-24"]);
  assert.deepEqual(chunkDates(chunk(`${filler} Doors open Oct 24, 7pm sharp. ${filler}`), REF)?.dates, ["2026-10-24"]);
  assert.equal(chunkDates(chunk(`${filler} Our favorite day is Oct 24 every year. ${filler}`), REF), null);
});
test("a date found in the middle is soft", () => {
  assert.equal(chunkDates(chunk(`${filler} Meet on Oct 24 at the gate. ${filler}`), REF)?.soft, true);
  assert.equal(chunkDates(chunk(`Sat, Oct 24 · 9-11am. ${filler}`), REF)?.soft, undefined);
});
test("deadlines and back-references are not the event's date", () => {
  assert.equal(chunkDates(chunk(`${filler} Registration closed Oct 3 at 5pm. ${filler}`), REF), null);
  assert.equal(chunkDates(chunk(`${filler} Founded on Mar 5 by two friends. ${filler}`), REF), null);
  assert.equal(chunkDates(chunk(`${filler} RSVP by Oct 22. Join us on Oct 24 for the party. ${filler}`), REF)?.dates[0], "2026-10-24");
  assert.equal(chunkDates(chunk(`A fun class for toddlers. Registration closes Oct 3`), REF), null);
});
test("old years are not event dates", () => {
  assert.equal(chunkDates(chunk(`${filler} We started on Mar 5, 2019 in a garage. ${filler}`), REF), null);
});
test("a short highlight is searched whole", () => {
  assert.deepEqual(chunkDates(chunk("Come to the fair on Nov 7, bring a friend."), REF)?.dates, ["2026-11-07"]);
});

// ---- ranking ----
import { mergeClicks } from "./rank";
import type { ClickRow } from "./types";
import { analyzeChunks, rankChunks } from "./rankChunks";

const T = { today: "2026-10-21", reference: REF };
const clicks = (...rows: [string, number, number?][]): Map<string, ReturnType<typeof mergeClicks> extends Map<string, infer V> ? V : never> =>
  mergeClicks(rows.map(([url, n, web = 0]): ClickRow => ({ url, email: { unique_verified_clicks: n, verified_clicks: n }, web: { unique_clicks: web } })));
let nextId = 0;
const item = (title: string, o: Partial<Chunk> & { link?: string } = {}): Chunk => {
  const { link, ...rest } = o;
  const url = link === undefined ? `https://ex.com/${title.toLowerCase().replace(/\W+/g, "-")}` : link;
  return { ...chunk(`${title} and a description that goes on for a while.`, o.when ?? null), id: nextId++, section: "What's on", kind: "bullet", title, url: url || null, key: url ? url.replace(/^http:/, "https:") : null, ...rest };
};
const ranks = (chunks: Chunk[], c: ReturnType<typeof clicks>, o: Partial<Parameters<typeof rankChunks>[2]> = {}) => {
  const r = rankChunks(chunks, c, { ...T, ...o });
  return chunks.filter((x) => r.has(x.id)).sort((a, b) => r.get(a.id)!.rank - r.get(b.id)!.rank).map((x) => x.title);
};

test("the most clicked comes first; items without clicks or a link are not ranked", () => {
  const a = item("A", { when: "Sat 24 Oct" }), b = item("B", { when: "Sat 24 Oct" }), c = item("C", { when: "Sat 24 Oct" }), d = item("D", { link: "" });
  assert.deepEqual(ranks([a, b, c, d], clicks([a.key!, 5], [b.key!, 9])), ["B", "A"]);
});

test("ties: total verified clicks, then the sooner date, then the order in the issue", () => {
  const a = item("A", { when: "Sun 25 Oct" }), b = item("B", { when: "Sat 24 Oct" }), c = item("C", { when: "Sat 24 Oct" });
  assert.deepEqual(ranks([a, b, c], clicks([a.key!, 4], [b.key!, 4], [c.key!, 4])), ["B", "C", "A"]);
});

test("items whose dates are all past are dropped; undated and recurring ones stay", () => {
  const past = item("Past", { when: "Mon 12 Oct" }), future = item("Future", { when: "Sat 24 Oct" }), none = item("Undated", { when: null }), weekly = item("Weekly", { when: "Mon 5 Oct (Weekly)" });
  const c = clicks([past.key!, 50], [future.key!, 5], [none.key!, 4], [weekly.key!, 3]);
  assert.deepEqual(ranks([past, future, none, weekly], c), ["Future", "Undated", "Weekly"]);
  assert.deepEqual(ranks([past, future, none, weekly], c, { onlyUpcoming: false }), ["Past", "Future", "Undated", "Weekly"]);
});

test("boilerplate links are never ranked, even with the most clicks", () => {
  const real = item("Real", { when: "Sat 24 Oct" });
  const un = item("Unsubscribe", { link: "https://fake.beehiiv.com/unsubscribe" });
  const prefs = item("Update your details", { link: "https://x.com/manage-preferences" });
  const up = item("Go premium", { link: "https://fake.beehiiv.com/upgrade" });
  const c = clicks([real.key!, 1], [un.key!, 90], [prefs.key!, 80], [up.key!, 70]);
  assert.deepEqual(ranks([real, un, prefs, up], c), ["Real"]);
});

test("a sponsor section is left out", () => {
  const real = item("Real", { when: "Sat 24 Oct" }), real2 = item("Real two", { when: "Sun 25 Oct" });
  const ad = item("Buy now", { section: "Presented by Acme" });
  assert.deepEqual(ranks([real, real2, ad], clicks([real.key!, 3], [real2.key!, 2], [ad.key!, 99])), ["Real", "Real two"]);
});

test("a feature story with more clicks than any event does not take the events list's top spot", () => {
  const story = item("The big story", { section: "Feature", kind: "paragraph" });
  const e1 = item("E1", { section: "This weekend", when: "Sat 24 Oct" }), e2 = item("E2", { section: "This weekend", when: "Sun 25 Oct" });
  assert.deepEqual(ranks([story, e1, e2], clicks([story.key!, 90], [e1.key!, 5], [e2.key!, 4])), ["E1", "E2"]);
});

test("a second events section without an event-like heading still counts when its items have dates", () => {
  const e1 = item("E1", { section: "This weekend", when: "Sat 24 Oct" }), e2 = item("E2", { section: "This weekend", when: "Sun 25 Oct" });
  const l1 = item("L1", { section: "Later this month", when: "Sat 31 Oct" }), l2 = item("L2", { section: "Later this month", when: "Sun 1 Nov" });
  assert.deepEqual(ranks([e1, e2, l1, l2], clicks([e1.key!, 5], [e2.key!, 4], [l1.key!, 9], [l2.key!, 1])), ["L1", "E1", "E2", "L2"]);
});

test("a link roundup (no dates, no event headings): every clicked link is a pick", () => {
  const a = item("A", { section: "Top stories", kind: "paragraph" }), b = item("B", { section: "Tools", kind: "bullet" }), c = item("C", { section: "Tools", kind: "bullet" });
  assert.deepEqual(ranks([a, b, c], clicks([a.key!, 3], [b.key!, 8], [c.key!, 5])), ["B", "C", "A"]);
});

test("the same link twice: the first is the pick", () => {
  const a = item("First", { link: "https://ex.com/same", when: "Sat 24 Oct" }), b = item("Second", { link: "https://ex.com/same", when: "Sat 24 Oct" }), c = item("Other", { when: "Sat 24 Oct" });
  assert.deepEqual(ranks([a, b, c], clicks(["https://ex.com/same", 9], [c.key!, 1])), ["First", "Other"]);
});

test("analyzeChunks says why each link was or was not ranked", () => {
  const ok = item("Ok", { when: "Sat 24 Oct" }), ok2 = item("Ok2", { when: "Sun 25 Oct" }), none = item("NoLink", { link: "" }), quiet = item("Quiet", { when: "Sat 24 Oct" }), past = item("Past", { when: "Mon 12 Oct" });
  const un = item("Unsubscribe", { link: "https://fake.beehiiv.com/unsubscribe" });
  const a = analyzeChunks([ok, ok2, none, quiet, past, un], clicks([ok.key!, 5], [ok2.key!, 4], [past.key!, 9], [un.key!, 9]), T);
  assert.deepEqual(a.map((x) => x.status), ["ranked", "ranked", "no link", "no clicks", "past", "boilerplate"]);
});

test("a link that differs from its click row only by a query string still matches", () => {
  const a = item("Tickets", { link: "https://x.com/tickets", when: "Sat 24 Oct" });
  const r = analyzeChunks([a], clicks(["https://x.com/tickets?ref_code=abc", 6]), T)[0];
  assert.deepEqual([r.status, r.loose, r.stats?.score], ["ranked", true, 6]);
});

test("nothing clicked, nothing ranked", () => {
  assert.deepEqual(ranks([item("A", { when: "Sat 24 Oct" })], clicks()), []);
});

import { dateLine, withDates } from "./rankChunks";

test("a date read from running text is written like a date line", () => {
  assert.equal(dateLine({ dates: ["2026-11-21"], recurring: false, at: 0 }), "Sat 21 Nov");
  assert.equal(dateLine({ dates: ["2026-11-21"], recurring: false, startTime: "19:00", endTime: "21:30", at: 0 }), "Sat 21 Nov @ 19:00-21:30");
  assert.equal(dateLine({ dates: ["2026-11-07", "2026-11-08"], recurring: false, at: 0 }), "Sat 7 Nov - Sun 8 Nov");
  assert.equal(dateLine({ dates: ["2026-11-21"], recurring: false, ends: true, at: 0 }), "Until Sat 21 Nov");
  assert.equal(dateLine({ dates: ["2026-11-21"], recurring: true, at: 0 }), null);
});

test("withDates: a highlight with its date in the middle gets a date line; a chunk with one keeps it", () => {
  const text = "Book now for the museum's fabulous Music Hall which sees their historic home, including the deep wells that Carlo Gatti used to store his precious Norwegian import ice in, transformed into a Victorian era music hall for one night only on Sat 21st Nov. The New Players Theatre Company will provide the entertainment.";
  const [a, b, c] = withDates([chunk(text, null), chunk(text, "Mon 2 Nov"), chunk("No date anywhere in this short text at all, honestly.", null)], "2026-11-06");
  assert.equal(a.when, "Sat 21 Nov");
  assert.equal(b.when, "Mon 2 Nov");
  assert.equal(c.when, null);
});
