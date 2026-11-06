// Runs the pretend beehiiv publications (src/lib/fakeBeehiiv.ts) through the same steps as a connected newsletter:
// find the post body, split it into chunks, merge the click data, read the dates, rank. Prints what happened to every link
// and checks the things that have to be true. Usage: yarn check:fake
import { fakeIssue, fakeIssuePage, fakePublications } from "../src/lib/fakeBeehiiv";
import { parseChunks } from "../src/lib/pollen/chunks";
import { contentRoot } from "../src/lib/pollen/content";
import { mergeClicks } from "../src/lib/pollen/rank";
import { analyzeChunks } from "../src/lib/pollen/rankChunks";

const today = new Date().toISOString().slice(0, 10);
let failures = 0;
const check = (ok: boolean, what: string) => {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}`);
};

type Expect = { ranked: string[]; notRanked: string[]; first?: string };
// What must hold for the newest issue (3 days old) of each pretend publication.
const EXPECT: Record<string, Expect> = {
  "Fake: Brooklyn Weekend Guide": {
    ranked: ["Prospect Park Fall Fest", "Pumpkin Patch at Smorgasburg", "Kids' Pottery Pop-up", "Halloween Parade", "Story Time at the Library"],
    // the feature story and the sponsor have the most clicks; the farmers market and costume swap are already over; the footer is boilerplate
    notRanked: ["Why the L train is closing again", "Open a kids' savings account", "Yesterday's Farmers Market", "Costume Swap", "Unsubscribe", "Manage preferences", "Read the archive"],
    first: "Halloween Parade",
  },
  "Fake: Dev Links Digest": {
    ranked: ["How async Rust actually works", "SQLite's write-ahead log, explained", "Native CSS nesting is here", "Ripgrep tricks", "Just: a command runner"],
    notRanked: ["Monitor your jobs with Dash", "Upgrade", "Unsubscribe"],
    first: "How async Rust actually works", // 52 + 10 from the second row
  },
  "Fake: Date Soup": {
    ranked: ["Westerpark Family Run", "Pancake Festival", "Winter Market", "Baby Yoga", "Family Film Night", "Parent Support Circle"],
    notRanked: ["Last Week's Bake Sale", "Unsubscribe"],
    first: "Westerpark Family Run",
  },
  "Fake: Welly Weekend": {
    // entries are spread over paragraphs; the day comes from the Friday/Saturday/Sunday subheadings; the Quick Picks lines repeat the same links
    ranked: ["Weber Bros presents The Circus", "Lantern Walk at the Gardens", "Harbourside Market", "Jazz at the Library", "Fun Run on the Waterfront", "Film Night at Light House", "Christmas Markets open"],
    notRanked: ["Win a $200 voucher", "Enter now", "RBar", "Little Beer Quarter", "Full forecast", "Wellington SPCA", "Unsubscribe"],
    first: "Weber Bros presents The Circus",
  },
};

for (const pub of fakePublications()) {
  const list = fakeIssuePage(pub.id, 1, 10)!;
  console.log(`\n=== ${pub.name} (${list.totalResults} issues) ===`);
  list.issues.forEach((meta, n) => {
    const raw = fakeIssue(pub.id, meta.id)!;
    const chunks = parseChunks(contentRoot(raw.html));
    const analysis = analyzeChunks(chunks, mergeClicks(raw.clicks), { today, reference: raw.publishedAt.slice(0, 10) });
    console.log(`\n${raw.title}  (published ${raw.publishedAt.slice(0, 10)}, ${chunks.length} chunks, ${raw.clicks.length} click rows)`);
    console.log("  rank score  dates                       title");
    for (const a of analysis.filter((x) => x.rank).sort((x, y) => x.rank! - y.rank!))
      console.log(`  ${String(a.rank).padStart(4)} ${String(a.stats!.score).padStart(5)}  ${(a.parsed?.dates.join(",") ?? "-").padEnd(26)}  ${a.chunk.title.slice(0, 48)}${a.loose ? "  [matched loosely]" : ""}${a.parsed?.recurring ? "  [recurring]" : ""}${a.parsed?.ends ? "  [ends]" : ""}`);
    const others = analysis.filter((x) => !x.rank && x.chunk.url);
    if (others.length) console.log("  not ranked:");
    for (const a of others) console.log(`        ${a.status.padEnd(13)} ${a.chunk.title.slice(0, 48)}${a.parsed ? `  (${a.parsed.dates.join(",")})` : ""}`);

    const titles = (status: "ranked" | "not") => analysis.filter((x) => (status === "ranked" ? x.rank : !x.rank)).map((x) => x.chunk.title);
    // Whatever the issue's age: the sponsor, the footer and the feature never rank.
    check(!titles("ranked").some((t) => /Acme|savings account|Dash|Unsubscribe|Manage preferences|Upgrade|archive/i.test(t)), "no sponsor or footer link is ranked");
    if (n === 0) {
      const want = EXPECT[pub.name];
      for (const t of want.ranked) check(titles("ranked").some((x) => x.startsWith(t)), `ranked: ${t}`);
      for (const t of want.notRanked) check(!titles("ranked").some((x) => x.startsWith(t)), `not ranked: ${t}`);
      if (want.first) check(analysis.find((x) => x.rank === 1)?.chunk.title.startsWith(want.first) === true, `first: ${want.first}`);
    }
  });
}
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
