import assert from "node:assert/strict";
import { test } from "node:test";
import { oneLineLimit, packGroups, picksPerSlide, planCustom, planSlides, shortBlurb, SHORT_BLURB, stripEmoji } from "./plan";
import type { SlideItem } from "./types";

const it = (id: number, o: Partial<SlideItem> = {}): SlideItem => ({ id, title: `Pick ${id}`, ...o });
const opts = { newsletter: "Just a Phase" };

test("picksPerSlide: fewer picks get more room", () => {
  assert.deepEqual([1, 4, 5, 10, 11, 30].map(picksPerSlide), [1, 1, 2, 2, 3, 3]);
});

test("stripEmoji and shortBlurb", () => {
  assert.equal(stripEmoji("🎃 Halloween  ❤️ fun"), "Halloween fun");
  assert.equal(shortBlurb("short"), "short");
  const s = shortBlurb("x".repeat(200));
  assert.equal(s.length, SHORT_BLURB);
  assert.ok(s.endsWith("…"));
  assert.equal(oneLineLimit(2), Infinity);
  assert.equal(oneLineLimit(3), SHORT_BLURB);
});

test("packGroups keeps a group together when it fits, and splits only longer ones", () => {
  const items = [it(1, { group: "A" }), it(2, { group: "A" }), it(3, { group: "B" }), it(4, { group: "B" }), it(5, { group: "B" })];
  const ids = (s: SlideItem[][]) => s.map((g) => g.map((x) => x.id));
  assert.deepEqual(ids(packGroups(items, 3)), [[1, 2], [3, 4, 5]]);
  assert.deepEqual(ids(packGroups(items, 2)).flat(), [1, 2, 3, 4, 5]);
  assert.ok(packGroups(items, 2).every((g) => g.length <= 2));
});

test("planSlides: cover, picks, closing; never more than 20 images", () => {
  const few = planSlides([it(1), it(2)], opts);
  assert.deepEqual(few.map((s) => s.kind), ["cover", "picks", "picks", "closing"]);
  const many = planSlides(Array.from({ length: 200 }, (_, i) => it(i)), opts);
  assert.ok(many.length <= 20);
  assert.equal(many[0].kind, "cover");
  assert.equal(many.at(-1)!.kind, "closing");
});

test("planCustom carries a pick's chosen picture id onto its slide item", () => {
  const spec = { slides: [[1], [2, 3]], edits: { 1: { photo: "0a1b2c3d" } } };
  const slides = planCustom([it(1), it(2), it(3)], spec, opts);
  const picks = slides.filter((s) => s.kind === "picks");
  assert.equal(picks[0].kind === "picks" && picks[0].items[0].photoId, "0a1b2c3d");
  assert.equal(picks[1].kind === "picks" && picks[1].items[0].photoId, undefined);
});

test("tags are dropped when showTags is false", () => {
  const slides = planSlides([it(1, { tag: "owner" })], { ...opts, showTags: false });
  const p = slides.find((s) => s.kind === "picks");
  assert.equal(p?.kind === "picks" && p.items[0].tag, undefined);
});

test("planCustom: slides as laid out, edits applied, unknown ids skipped, empty slides dropped", () => {
  const slides = planCustom([it(1, { group: "West", when: "Sat" }), it(2), it(3)], { slides: [[1, 2], [99], [3]], edits: { 1: { title: " New ", when: "", group: "East" } } }, opts);
  assert.deepEqual(slides.map((s) => s.kind), ["cover", "picks", "picks", "closing"]);
  const first = slides[1];
  assert.ok(first.kind === "picks");
  assert.equal(first.items[0].title, "New");
  assert.equal(first.items[0].when, null);
  assert.equal(first.items[0].group, "East");
  assert.equal(first.group, undefined, "mixed labels: no shared header");
  assert.deepEqual([first.page, first.pages], [1, 2]);
  assert.equal(slides[0].kind === "cover" && slides[0].subtitle, "3 picks from Just a Phase");
});

test("planCustom: an empty category edit removes the label; a shared label becomes the slide's", () => {
  const s = planCustom([it(1, { group: "West" }), it(2, { group: "West" })], { slides: [[1, 2]], edits: { 2: { group: "" } } }, opts);
  const p = s[1];
  assert.ok(p.kind === "picks");
  assert.equal(p.items[1].group, undefined);
  assert.equal(p.group, undefined);
  const same = planCustom([it(1, { group: "West" }), it(2, { group: "West" })], { slides: [[1, 2]] }, opts)[1];
  assert.ok(same.kind === "picks" && same.group === "West");
});

test("planCustom: hidden tags, at most 4 per slide, spec text beats options", () => {
  const items = [1, 2, 3, 4, 5].map((i) => it(i, { tag: "t" }));
  const s = planCustom(items, { slides: [[1, 2, 3, 4, 5]], hideTags: [true], cover: { title: "Mine" } }, { ...opts, heading: "Theirs" });
  const p = s[1];
  assert.ok(p.kind === "picks");
  assert.equal(p.items.length, 4);
  assert.ok(p.items.every((x) => x.tag === undefined));
  assert.equal(s[0].kind === "cover" && s[0].title, "Mine");
  assert.equal(planCustom(items, { slides: [[1]] }, { ...opts, heading: "Theirs" })[0].kind === "cover" && true, true);
});

test("a cover or closing field emptied on purpose stays empty; one never touched keeps its default", () => {
  const items = [it(1), it(2)];
  const slides = planCustom(items, { slides: [[1, 2]], cover: { title: "", subtitle: "Just this" }, closing: { line: "", cta: "" } }, opts);
  const cover = slides[0];
  const closing = slides[slides.length - 1];
  assert.ok(cover.kind === "cover" && closing.kind === "closing");
  assert.equal(cover.title, "");
  assert.equal(cover.subtitle, "Just this");
  assert.equal(closing.line, "");
  assert.equal(closing.cta, "");
  assert.equal(closing.title, "Want the full list?"); // never touched
});

test("a pick whose title was emptied has no title; the cover's picture and where it goes reach the slide", () => {
  const slides = planCustom([it(1, { blurb: "Only the description" })], { slides: [[1]], edits: { 1: { title: "" } }, cover: { photo: "0a1b2c3d", photoMode: "background" } }, opts);
  const picks = slides[1];
  assert.ok(picks.kind === "picks");
  assert.equal(picks.items[0].title, "");
  assert.equal(picks.items[0].blurb, "Only the description");
  assert.ok(slides[0].kind === "cover");
  assert.equal(slides[0].photoId, "0a1b2c3d");
  assert.equal(slides[0].photoMode, "background");
});

test("every pick slide knows the carousel's title, for the Carousel title corner", () => {
  const custom = planCustom([it(1)], { slides: [[1]], cover: { title: "Dit weekend" } }, opts);
  assert.equal(custom[1].kind === "picks" && custom[1].carouselTitle, "Dit weekend");
  const standard = planSlides([it(1)], { ...opts, heading: "Autumn picks" });
  assert.equal(standard[1].kind === "picks" && standard[1].carouselTitle, "Autumn picks");
});

test("the cover's background defaults to the issue's preview image, unless a picture or None was chosen", () => {
  const withDefault = { ...opts, defaultCoverPhoto: "0a1b2c3d" };
  const cover = (s: ReturnType<typeof planSlides>) => s[0] as Extract<(typeof s)[number], { kind: "cover" }>;
  // Standard layout and a hand-built one with nothing chosen: the default, as the background.
  for (const slides of [planSlides([it(1)], withDefault), planCustom([it(1)], { slides: [[1]] }, withDefault)]) {
    assert.equal(cover(slides).photoId, "0a1b2c3d");
    assert.equal(cover(slides).photoMode, "background");
  }
  // A chosen picture wins; "None" (noPhoto) keeps the plain color; no default means no picture.
  assert.equal(cover(planCustom([it(1)], { slides: [[1]], cover: { photo: "0a1b2c3e", photoMode: "section" } }, withDefault)).photoId, "0a1b2c3e");
  assert.equal(cover(planCustom([it(1)], { slides: [[1]], cover: { noPhoto: true } }, withDefault)).photoId, undefined);
  assert.equal(cover(planSlides([it(1)], opts)).photoId, undefined);
  assert.equal(cover(planCustom([it(1)], { slides: [[1]] }, opts)).photoId, undefined);
});
