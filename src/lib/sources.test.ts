import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, mock, test } from "node:test";
import type { BeehiivIssueContent } from "./beehiiv";
import type { ClickRow } from "./pollen/types";
import { buildIssue } from "./sources";

// The saved sample issue (#49) with its real click rows, built the way a connected newsletter's issue is.
const dir = join(process.cwd(), "fixtures");
const html = readFileSync(join(dir, "issue-49.html"), "utf8");
const { post, clicks } = JSON.parse(readFileSync(join(dir, "issue-49.clicks.json"), "utf8")) as { post: { id: string; title: string; publishedAt: string; url: string }; clicks: ClickRow[] };

const issue = (rows: ClickRow[]) => buildIssue({ id: post.id, title: post.title, publishedAt: post.publishedAt, url: post.url, html, clicks: rows } satisfies BeehiivIssueContent, "Just a Phase");
const today = (date: string) => mock.timers.enable({ apis: ["Date"], now: new Date(`${date}T10:00:00Z`) });
afterEach(() => mock.timers.reset());

test("Top clicks is on when something in the issue is ranked by clicks", () => {
  today("2026-10-21");
  const i = issue(clicks);
  assert.equal(i.hasClicks, true);
  assert.ok(i.chunks.some((c) => c.rank));
});

test("Top clicks is off when beehiiv returns no click rows", () => {
  today("2026-10-21");
  assert.equal(issue([]).hasClicks, false);
});

test("Top clicks is off when the click rows are all for links that are not picks (a story, the archive, the footer)", () => {
  today("2026-10-21");
  const rows = clicks.filter((r) => /stories\/kyle-k|\/archive|powered-by/.test(r.url));
  assert.ok(rows.length > 0, "there are click rows, so the tab used to be on");
  const i = issue(rows);
  assert.ok(i.chunks.every((c) => !c.rank), "nothing is ranked");
  assert.equal(i.hasClicks, false);
});

test("Top clicks is off once the only clicked event is over, and on while it is still ahead", () => {
  const rows = clicks.filter((r) => r.url.includes("DePIHoLCBzg")); // Halloween Party at Wachterliedplantsoen, Sun 25 Oct
  assert.ok(rows.length > 0);
  today("2026-10-21");
  assert.equal(issue(rows).hasClicks, true);
  mock.timers.reset();
  today("2026-10-26");
  assert.equal(issue(rows).hasClicks, false);
});

test("an issue with no links at all (fixtures/no-links-issue) has nothing to rank and Top clicks is off", () => {
  today("2026-11-11");
  const html = readFileSync(join(dir, "no-links-issue.html"), "utf8");
  const { post, clicks } = JSON.parse(readFileSync(join(dir, "no-links-issue.clicks.json"), "utf8")) as { post: { id: string; title: string; publishedAt: string; url: string }; clicks: ClickRow[] };
  assert.equal(clicks.length, 0);
  assert.doesNotMatch(html, /href=/);
  const i = buildIssue({ id: post.id, title: post.title, publishedAt: post.publishedAt, url: post.url, html, clicks } satisfies BeehiivIssueContent, "Test newsletter");
  assert.equal(i.hasClicks, false);
  assert.ok(i.chunks.length > 0, "the text still comes through as picks");
  assert.ok(i.chunks.every((c) => !c.rank));
});
