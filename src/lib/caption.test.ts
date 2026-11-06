import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCaption, captionLeftOut, dayLabel, isInstagram, limitOf, MAX_CAPTION_CHARS, sortCaptionItems, variantFor, variantLimit, type CaptionItem } from "./caption";

const it = (title: string, o: Partial<CaptionItem> = {}): CaptionItem => ({ title, when: null, place: null, rank: null, date: null, ...o });
const base = { newsletter: "Just a Phase", link: "https://jap.example/p/49" } as const;

test("dayLabel", () => {
  assert.equal(dayLabel("2026-10-20"), "Tue 20 Oct");
  assert.equal(dayLabel("2027-01-01"), "Fri 1 Jan");
});

test("networks: Instagram points to the bio, the rest get the link", () => {
  assert.equal(isInstagram("Instagram"), true);
  assert.equal(isInstagram("instagram "), true);
  assert.equal(isInstagram("linkedin"), false);
  assert.equal(variantFor("instagram"), "instagram");
  assert.equal(variantFor("linkedin"), "link");
  assert.equal(variantFor("facebook"), "link");
  for (const s of ["twitter", "x", "bluesky", "threads", "mastodon", "Threads"]) assert.equal(variantFor(s), "short", s);
});

test("sorting: clicks (unranked last), A-Z without emoji or case, date then time (undated last)", () => {
  const titles = (items: CaptionItem[], order: Parameters<typeof sortCaptionItems>[1]) => sortCaptionItems(items, order).map((i) => i.title);
  assert.deepEqual(titles([it("C"), it("A", { rank: 2 }), it("B", { rank: 1 })], "clicks"), ["B", "A", "C"]);
  assert.deepEqual(titles([it("banana"), it("🎃 Apple"), it("Cherry")], "alpha"), ["🎃 Apple", "banana", "Cherry"]);
  assert.deepEqual(
    titles([it("Undated"), it("Late", { date: "2026-10-25", time: "09:00" }), it("Early", { date: "2026-10-25", time: "08:00" }), it("First", { date: "2026-10-24" })], "date"),
    ["First", "Early", "Late", "Undated"],
  );
});

test("sorting is stable: ties keep the order the picks were made in", () => {
  assert.deepEqual(sortCaptionItems([it("B"), it("A"), it("C")], "clicks").map((i) => i.title), ["B", "A", "C"]);
});

test("an Instagram caption by clicks", () => {
  const text = buildCaption([it("Story time", { when: "Sat 24 Oct @ 9:30", place: "De Pijp", rank: 1 })], { ...base, order: "clicks", variant: "instagram" });
  assert.equal(text, ["This week's picks from Just a Phase 🌼", "", "🔥 Story time — Sat 24 Oct @ 9:30 (De Pijp)", "", "Details on every pick are in the newsletter. Link in bio."].join("\n"));
});

test("other networks get the link", () => {
  const text = buildCaption([it("A", { rank: 1 })], { ...base, order: "clicks", variant: "link" });
  assert.ok(text.endsWith("Read it here: https://jap.example/p/49"));
});

test("a public post's caption credits the original, and the author and heading are used", () => {
  const text = buildCaption([it("A", { rank: 1 })], { ...base, order: "clicks", variant: "instagram", creditLink: true, author: "Sam", heading: "Best reads" });
  assert.ok(text.startsWith("Best reads from Just a Phase by Sam 🌼"));
  assert.ok(text.endsWith("Read the original post: https://jap.example/p/49"));
  assert.ok(!text.includes("Details on every pick"));
});

test("the recurrence note is left out of the caption", () => {
  const text = buildCaption([it("Class", { when: "Thu 22 Oct @ 09:30-10:30 (Weekly)", rank: 1 })], { ...base, order: "clicks", variant: "link" });
  assert.ok(text.includes("Class — Thu 22 Oct @ 09:30-10:30") && !text.includes("Weekly"));
});

test("by date: the day leads; undated picks come after under 'Other picks:'", () => {
  const text = buildCaption([it("Undated"), it("Dated", { date: "2026-10-24", place: "Park" })], { ...base, order: "date", variant: "link" });
  assert.ok(text.includes("🗓️ Sat 24 Oct: Dated (Park)"));
  assert.ok(text.includes("Other picks:\n\n• Undated"));
  assert.ok(text.indexOf("Dated") < text.indexOf("Other picks:"));
});

test("only Instagram gets the @tag credit", () => {
  const items = [it("A", { rank: 1, tag: "theowner" })];
  assert.ok(buildCaption(items, { ...base, order: "clicks", variant: "instagram" }).includes("· From @theowner"));
  assert.ok(!buildCaption(items, { ...base, order: "clicks", variant: "link" }).includes("@theowner"));
});

test("the category label follows the place and comes before the tag", () => {
  const text = buildCaption([it("A", { rank: 1, when: "Sat 24 Oct", place: "Park", group: "West", tag: "owner" })], { ...base, order: "clicks", variant: "instagram" });
  assert.ok(text.includes("🔥 A — Sat 24 Oct (Park) · West · From @owner"), text);
});

test("a long list is cut to fit, with a count of what was left out", () => {
  const items = Array.from({ length: 60 }, (_, i) => it(`Pick number ${i} ${"x".repeat(80)}`, { rank: i + 1 }));
  const opts = { ...base, order: "clicks", variant: "instagram" } as const;
  const text = buildCaption(items, opts);
  assert.ok(text.length <= MAX_CAPTION_CHARS);
  const more = Number(/…and (\d+) more/.exec(text)?.[1]);
  assert.ok(more > 0);
  assert.equal(captionLeftOut(items, opts).length, more);
  assert.ok(text.includes("Pick number 0 "), "the best picks stay");
});

test("at least one pick always stays", () => {
  const text = buildCaption([it("x".repeat(3000), { rank: 1 })], { ...base, order: "clicks", variant: "link" });
  assert.ok(text.includes("xxxx"));
});

test("limits: each network's own, and the tightest among the ones that share a caption", () => {
  assert.equal(limitOf("twitter"), 280);
  assert.equal(limitOf("Bluesky"), 300);
  assert.equal(limitOf("linkedin"), 3000);
  assert.equal(limitOf("tiktok"), undefined);
  assert.equal(variantLimit("short", ["bluesky", "twitter", "threads"]), 280);
  assert.equal(variantLimit("short", ["bluesky", "threads"]), 300);
  assert.equal(variantLimit("short", ["mastodon"]), 500);
  assert.equal(variantLimit("link", ["linkedin", "facebook"]), 3000);
  assert.equal(variantLimit("link", ["facebook"]), 5000);
  assert.equal(variantLimit("instagram", ["instagram"]), MAX_CAPTION_CHARS);
  assert.equal(variantLimit("short", ["linkedin", "instagram"]), 280, "no short network connected: the default");
  assert.equal(variantLimit("link", []), 2200);
});

test("a short caption: titles with their day, the full link, no tag, and it fits", () => {
  const items = [it("Gatti's Music Hall", { rank: 1, date: "2026-11-21", tag: "camden", when: "Sat 21 Nov" }), it("L'Orient", { rank: 2 }), it("God Save The Queens", { rank: 3 }), it("The Future of Knowledge", { rank: 4 }), it("Fifth pick with a rather long title", { rank: 5 }), it("Sixth pick with a rather long title too", { rank: 6 }), it("Seventh pick with a rather long title as well", { rank: 7 }), it("Eighth pick with yet another long title", { rank: 8 })];
  const text = buildCaption(items, { ...base, order: "clicks", variant: "short", limit: 280 });
  assert.ok(text.length <= 280, String(text.length));
  assert.ok(text.includes("🔥 Gatti's Music Hall (Sat 21 Nov)"));
  assert.ok(text.endsWith("Read it here: https://jap.example/p/49"));
  assert.ok(!text.includes("@camden") && !text.includes("Details on every pick") && !text.includes("Link in bio"));
  const more = Number(/…and (\d+) more/.exec(text)?.[1]);
  assert.ok(more > 0);
  assert.equal(captionLeftOut(items, { ...base, order: "clicks", variant: "short", limit: 280 }).length, more);
});

test("a short caption by date has no 'Other picks' heading", () => {
  const text = buildCaption([it("Dated", { date: "2026-11-21" }), it("Undated")], { ...base, order: "date", variant: "short", limit: 280 });
  assert.ok(!text.includes("Other picks"));
});

test("the base caption may use the room LinkedIn has", () => {
  const items = Array.from({ length: 40 }, (_, i) => it(`Pick number ${i} ${"x".repeat(60)}`, { rank: i + 1 }));
  const small = buildCaption(items, { ...base, order: "clicks", variant: "link", limit: 2196 });
  const big = buildCaption(items, { ...base, order: "clicks", variant: "link", limit: 3000 });
  assert.ok(small.length <= 2196 && big.length <= 3000 && big.length > 2196);
});
