import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ALT_MAX, altTextFor, altTexts, clipAlt } from "./alt";
import type { Slide } from "./types";

// Alt text is the slide's own words: nothing generated, nothing rewritten, only shortened to a length every network takes.
describe("alt text", () => {
  test("a cover says its title and subtitle", () => {
    const s: Slide = { kind: "cover", title: "Weekend picks", subtitle: "Issue 49" };
    assert.equal(altTextFor(s), "Weekend picks. Issue 49");
  });
  test("a slide of picks says each pick's title and date", () => {
    const s: Slide = { kind: "picks", items: [{ title: "Canal Yoga", when: "Sat 14 Nov" }, { title: "Story Time" }], page: 1, pages: 1 };
    assert.equal(altTextFor(s), "Canal Yoga, Sat 14 Nov; Story Time");
  });
  test("a pick with no title says its description instead", () => {
    const s: Slide = { kind: "picks", items: [{ title: "", blurb: "Songs and stories for babies", when: "Sat 14 Nov" }, { title: "  ", blurb: "Bring a blanket" }], page: 1, pages: 1 };
    assert.equal(altTextFor(s), "Songs and stories for babies, Sat 14 Nov; Bring a blanket");
  });
  test("the closing slide says its title and line", () => {
    const s: Slide = { kind: "closing", title: "See you next week", line: "Subscribe", more: 0 };
    assert.equal(altTextFor(s), "See you next week. Subscribe");
  });
  test("emoji and stray spaces are dropped, since a screen reader would read each out in words", () => {
    const s: Slide = { kind: "picks", items: [{ title: "  Pumpkin   patch 🎃  ", when: "Sat" }], page: 1, pages: 1 };
    assert.equal(altTextFor(s), "Pumpkin patch, Sat");
  });
  test("a long text is cut at a word, with an ellipsis, and never over the limit", () => {
    const long = "A very long title about a family morning at the waterfront with pancakes and music and a puppet show for the smallest ones. ".repeat(3);
    const out = clipAlt(long);
    assert.ok(out.length <= ALT_MAX);
    assert.ok(out.endsWith("…"));
    assert.ok(long.startsWith(out.slice(0, -1)));
    assert.doesNotMatch(out, / …$/);
  });
  test("the limit is Buffer's recommended 200, under LinkedIn's 300", () => {
    assert.equal(ALT_MAX, 200);
  });
  test("three picks with dates fit whole", () => {
    const s: Slide = {
      kind: "picks",
      items: [
        { title: "Cozy ceramic workshop", when: "Wed 4 Nov" },
        { title: "Baby swim for new parents", when: "Sat 7 Nov" },
        { title: "Stroller walk in Vondelpark", when: "Sun 8 Nov" },
      ],
      page: 1,
      pages: 1,
    };
    assert.equal(altTextFor(s), "Cozy ceramic workshop, Wed 4 Nov; Baby swim for new parents, Sat 7 Nov; Stroller walk in Vondelpark, Sun 8 Nov");
  });
  test("text that fits is left exactly as it is", () => {
    assert.equal(clipAlt("Short and sweet"), "Short and sweet");
  });
  test("one alt text per slide, in order", () => {
    const slides: Slide[] = [
      { kind: "cover", title: "A", subtitle: "" },
      { kind: "closing", title: "Z", line: "", more: 0 },
    ];
    assert.deepEqual(altTexts(slides), ["A", "Z"]);
  });
  test("a slide with nothing to say gives an empty text, which is simply not sent", () => {
    assert.equal(altTextFor({ kind: "picks", items: [], page: 1, pages: 1 }), "");
  });
});
