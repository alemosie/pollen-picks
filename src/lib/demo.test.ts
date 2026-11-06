import assert from "node:assert/strict";
import { test } from "node:test";
import { loadDemoIssue } from "./demo";

// A snapshot of the sample issue (#49, as of Wed 21 Oct 2026). If the parser, the dates or the ranking change what the demo shows, this says so.
test("the sample issue ranks the way the demo shows it", () => {
  const issue = loadDemoIssue();
  const ranked = issue.chunks.filter((c) => c.rank).sort((a, b) => a.rank! - b.rank!);
  assert.equal(issue.chunks.length, 41);
  assert.equal(issue.hasClicks, true);
  assert.deepEqual(
    ranked.slice(0, 4).map((c) => [c.rank, c.score, c.title]),
    [
      [1, 14, "Suzuki Music for Babies & Toddlers Fall (0-3 years)"],
      [2, 14, "Mama+ Club Halloween Meetup"],
      [3, 13, "Halloween Brunch & Costume Party"],
      [4, 11, "Halloween Parade at Speeltuin Sloten"],
    ],
  );
  assert.deepEqual(ranked.map((c) => c.rank), ranked.map((_, i) => i + 1), "ranks are 1, 2, 3 ... with no gaps");
});

test("the feature story (most clicks overall), the donate line and unclicked events are not ranked", () => {
  const issue = loadDemoIssue();
  const rankedTitles = new Set(issue.chunks.filter((c) => c.rank).map((c) => c.title));
  assert.ok(!rankedTitles.has("Amsterdam Mamas Spooktacular Parade"), "no clicks");
  assert.ok(!rankedTitles.has("donating"));
  assert.ok(issue.chunks.every((c) => !c.rank || c.section.includes("happening")), "only the activities section is ranked");
});
