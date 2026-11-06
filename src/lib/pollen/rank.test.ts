import assert from "node:assert/strict";
import { test } from "node:test";
import { clickLookup, mergeClicks } from "./rank";
import type { ClickRow } from "./types";

const row = (url: string, email: ClickRow["email"], web: ClickRow["web"] = {}): ClickRow => ({ url, email, web });

test("mergeClicks reads the REST API's spelling: verified email clickers plus web clickers", () => {
  const m = mergeClicks([row("https://x.com/a", { unique_verified_clicks: 5, verified_clicks: 6 }, { unique_clicks: 2, clicks: 2 })]);
  assert.deepEqual(m.get("https://x.com/a"), { key: "https://x.com/a", score: 7, totalVerified: 8, rows: 1 });
});

test("mergeClicks reads the export's spelling too", () => {
  const m = mergeClicks([row("https://x.com/a", { total_unique_clicked_verified: 3, total_clicked_verified: 4 }, { total_unique_clicked: 1, total_clicked: 1 })]);
  assert.equal(m.get("https://x.com/a")?.score, 4);
  assert.equal(m.get("https://x.com/a")?.totalVerified, 5);
});

test("unverified clicks do not count (link scanners)", () => {
  const m = mergeClicks([row("https://x.com/a", { unique_clicks: 50, clicks: 90 })]);
  assert.equal(m.get("https://x.com/a")?.score, 0);
});

test("rows for the same link are added up, whatever their tracking parameters", () => {
  const m = mergeClicks([
    row("https://www.x.com/a/?utm_source=one", { unique_verified_clicks: 5 }),
    row("https://x.com/a?utm_campaign=two&_bhlid=z", { unique_verified_clicks: 3 }, { unique_clicks: 1 }),
  ]);
  assert.equal(m.size, 1);
  assert.deepEqual([m.get("https://x.com/a")?.score, m.get("https://x.com/a")?.rows], [9, 2]);
});

test("rows that are not web links are skipped", () => {
  assert.equal(mergeClicks([row("mailto:a@b.com", { unique_verified_clicks: 9 })]).size, 0);
});

const stats = (...keys: string[]) => new Map(keys.map((k) => [k, { key: k, score: 1, totalVerified: 1, rows: 1 }]));

test("clickLookup: an exact match is not loose", () => {
  const find = clickLookup(stats("https://x.com/e?id=1"));
  assert.deepEqual([find("https://x.com/e?id=1")?.loose, find("https://x.com/e?id=1")?.stats.key], [false, "https://x.com/e?id=1"]);
});

test("clickLookup: a link without a query string matches the same page with one, and the other way round", () => {
  assert.equal(clickLookup(stats("https://x.com/e?ref_code=abc"))("https://x.com/e")?.loose, true);
  assert.equal(clickLookup(stats("https://x.com/e"))("https://x.com/e?ref_code=abc")?.loose, true);
});

test("clickLookup: two different query strings are two different pages", () => {
  assert.equal(clickLookup(stats("https://x.com/e?id=2"))("https://x.com/e?id=1"), null);
});

test("clickLookup: several candidates are too ambiguous to guess", () => {
  assert.equal(clickLookup(stats("https://x.com/e?id=1", "https://x.com/e?id=2"))("https://x.com/e"), null);
});

test("clickLookup: nothing clicked", () => {
  assert.equal(clickLookup(stats("https://x.com/a"))("https://x.com/b"), null);
});
