import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { postTitleOf, POST_DESCRIPTION_MAX } from "./postTitle";
import type { Slide, SlideItem } from "./types";

const picks = (...items: SlideItem[]): Slide => ({ kind: "picks", items, page: 1, pages: 1 });
const cover: Slide = { kind: "cover", title: "This week's picks", subtitle: "2 picks from N" };

describe("postTitleOf", () => {
  test("the first pick's title, not the cover's", () => {
    assert.equal(postTitleOf([cover, picks({ title: "Baby Rhyme Time" }, { title: "Second" })]), "Baby Rhyme Time");
  });

  test("no title: the description, cut short with an ellipsis", () => {
    const blurb = "Songs and rhymes for babies under one. ".repeat(10);
    const t = postTitleOf([picks({ title: "  ", blurb })]);
    assert.ok(t.startsWith("Songs and rhymes"));
    assert.ok(t.endsWith("…"));
    assert.ok(t.length <= POST_DESCRIPTION_MAX);
  });

  test("a short description is kept whole", () => {
    assert.equal(postTitleOf([picks({ title: "", blurb: "Free   walk\nin the park" })]), "Free walk in the park");
  });

  test("nothing to say: empty", () => {
    assert.equal(postTitleOf([cover, picks({ title: "", blurb: "" })]), "");
    assert.equal(postTitleOf([]), "");
  });
});
