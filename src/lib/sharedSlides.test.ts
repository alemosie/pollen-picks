import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cleanShareLinks } from "./sharedSlides";

const HOSTS = ["pollen.test"];
const slide = "https://pollen.test/demo/design?picks=1,2&hl=abc";

describe("what a shared creation keeps", () => {
  test("the slide link and the source link", () => {
    const s = cleanShareLinks({ slideUrl: slide, sourceUrl: "https://example.com/p/issue-50" }, HOSTS);
    assert.deepEqual(s, { source_url: "https://example.com/p/issue-50", slide_url: slide });
  });
  test("a creation made from the sample has no source link", () => {
    assert.deepEqual(cleanShareLinks({ slideUrl: slide, sourceUrl: null }, HOSTS), { source_url: null, slide_url: slide });
  });
  test("the logged-in app's Design address is kept too", () => {
    const own = "https://pollen.test/design?mode=own%3Apub_1%3Apost_2&picks=3";
    assert.equal(cleanShareLinks({ slideUrl: own, sourceUrl: null }, HOSTS)?.slide_url, own);
  });
  test("a slide link to another site, or to another page of this one, is not kept", () => {
    assert.equal(cleanShareLinks({ slideUrl: "https://evil.test/demo/design?picks=1" }, HOSTS), null);
    assert.equal(cleanShareLinks({ slideUrl: "https://pollen.test/settings" }, HOSTS), null);
    assert.equal(cleanShareLinks({ slideUrl: "https://pollen.test/api/slide/preview?picks=1" }, HOSTS), null);
  });
  test("not a web address, too long, or no object: nothing is kept", () => {
    for (const v of [null, undefined, "x", 5, [1], {}, { slideUrl: "javascript:alert(1)" }, { slideUrl: "https://pollen.test/design?x=" + "a".repeat(4000) }]) assert.equal(cleanShareLinks(v, HOSTS), null);
  });
  test("a bad source link is dropped but the slide link stays", () => {
    assert.deepEqual(cleanShareLinks({ slideUrl: slide, sourceUrl: "javascript:alert(1)" }, HOSTS), { source_url: null, slide_url: slide });
  });
});
