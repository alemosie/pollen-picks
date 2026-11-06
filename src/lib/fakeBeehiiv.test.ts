import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeIssue, fakeIssuePage, fakePublications, isFakeKey, FAKE_KEY } from "./fakeBeehiiv";
import { parseChunks } from "./pollen/chunks";
import { contentRoot } from "./pollen/content";
import { mergeClicks } from "./pollen/rank";
import { analyzeChunks } from "./pollen/rankChunks";

const today = new Date().toISOString().slice(0, 10);
const newest = (name: RegExp) => {
  const pub = fakePublications().find((p) => name.test(p.name))!;
  const meta = fakeIssuePage(pub.id, 1, 10)!.issues[0];
  const raw = fakeIssue(pub.id, meta.id)!;
  const chunks = parseChunks(contentRoot(raw.html));
  return analyzeChunks(chunks, mergeClicks(raw.clicks), { today, reference: raw.publishedAt.slice(0, 10) });
};

test("the fake key is recognised", () => {
  assert.equal(isFakeKey(FAKE_KEY), true);
  assert.equal(isFakeKey("real_key"), false);
});

test("four publications, three issues each", () => {
  const pubs = fakePublications();
  assert.equal(pubs.length, 4);
  for (const p of pubs) assert.equal(fakeIssuePage(p.id, 1, 10)!.totalResults, 3);
});

test("Welly Weekend: no bullets, details lines and day subheadings still give ranked, dated events", () => {
  const a = newest(/Welly/);
  const ranked = a.filter((x) => x.rank).sort((x, y) => x.rank! - y.rank!);
  assert.equal(ranked[0].chunk.title, "Weber Bros presents The Circus");
  assert.ok(ranked.every((x) => x.parsed), "every ranked entry has a date");
  const titles = ranked.map((x) => x.chunk.title);
  for (const t of ["Win a $200 voucher", "Enter now", "RBar", "Full forecast", "Wellington SPCA"]) assert.ok(!titles.includes(t), t);
});

test("Dev Links Digest: every clicked link ranks, sponsor and footer do not", () => {
  const titles = newest(/Dev Links/).filter((x) => x.rank).map((x) => x.chunk.title);
  assert.equal(titles.length, 8);
  assert.ok(!titles.some((t) => /Dash|Upgrade|Unsubscribe/.test(t)));
});
