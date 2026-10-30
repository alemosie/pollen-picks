// Runs the pipeline against the saved Oct 19 issue (#49).  Usage: yarn pipeline:fixture [YYYY-MM-DD]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseActivities } from "../src/lib/pollen/parse";
import { mergeClicks, rankActivities, unmatchedClicks } from "../src/lib/pollen/rank";
import type { ClickRow } from "../src/lib/pollen/types";

const dir = join(__dirname, "..", "fixtures");
const html = readFileSync(join(dir, "issue-49.html"), "utf8");
const { post, clicks } = JSON.parse(readFileSync(join(dir, "issue-49.clicks.json"), "utf8")) as { post: { publishedAt: string; title: string }; clicks: ClickRow[] };

const today = process.argv[2] ?? "2026-10-21"; // demo mode freezes "today" to Wed 21 Oct
const reference = post.publishedAt.slice(0, 10);

const activities = parseActivities(html, { reference });
const stats = mergeClicks(clicks);
const ranked = rankActivities(activities, stats, { today, onlyUpcoming: true });

console.log(`${post.title}  (today = ${today})`);
console.log(`activities: ${activities.length}, with link: ${activities.filter((a) => a.key).length}, ranked: ${ranked.filter((a) => a.rank).length}\n`);
console.log("rank  score  total  when                                          title");
for (const a of ranked.filter((r) => r.rank).sort((x, y) => x.rank! - y.rank!)) {
  console.log(`${String(a.rank).padStart(3)}   ${String(a.stats!.score).padStart(4)}  ${String(a.stats!.totalVerified).padStart(5)}  ${(a.when ?? "-").padEnd(44).slice(0, 44)}  ${a.title}${a.upcoming === null ? "  [undated]" : ""}`);
}
console.log("\nnot ranked:");
for (const a of ranked.filter((r) => !r.rank)) {
  const why = !a.key ? "no link" : !a.stats ? "no clicks" : a.upcoming === false ? "past" : "?";
  console.log(`  - ${a.title}  (${why})${a.blurbLinks.length && !a.key ? `  blurb links: ${a.blurbLinks.length}` : ""}`);
}
console.log("\nclicked links that are not activities (excluded):");
for (const s of unmatchedClicks(activities, stats).slice(0, 8)) console.log(`  ${String(s.score).padStart(3)}  ${s.key}`);
