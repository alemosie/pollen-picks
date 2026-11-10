import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeSpec, encodeSpec, pickEditsFor, MAX_CUSTOM_SLIDES, MAX_PER_SLIDE, parseTemplate, SPEC_LIMITS, templateParams, type CustomSpec } from "./options";

test("a spec survives the round trip, including the category label and unicode", () => {
  const spec: CustomSpec = {
    cover: { title: "Dit weekend 🎃", subtitle: "Café picks", bg: "#f6bd60" },
    closing: { title: "More", line: "Read on", cta: "Go", bg: "#112233" },
    slides: [[1, 2], [3]],
    bgs: ["#aabbcc", ""],
    edits: { 2: { title: "Ñandú", when: "Sat", place: "Park", blurb: "Fun", group: "West", bg: "#010203", tag: "cafe.west", hideTag: true } },
  };
  assert.deepEqual(decodeSpec(encodeSpec(spec)), spec);
});

test("a picture choice survives the round trip as an id only; a bad id or an empty one is dropped", () => {
  const spec: CustomSpec = { slides: [[1], [2]], edits: { 1: { photo: "0a1b2c3d", title: "Kept" }, 2: { photo: "" } } };
  const back = decodeSpec(encodeSpec(spec))!;
  assert.equal(back.edits![1].photo, "0a1b2c3d");
  assert.equal(back.edits![1].title, "Kept");
  assert.equal(back.edits![2], undefined);
  const wire = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  // An address (or anything but 8 hex digits) is never accepted as a picture: the server only looks ids up in the issue.
  for (const bad of ["https://evil.example/x.png", "ZZZZZZZZ", "0a1b2c3", "0a1b2c3d4"]) assert.equal(decodeSpec(wire({ s: [[1]], e: { 1: { o: bad, t: "x" } } }))!.edits![1].photo, undefined);
});

test("a photo credit travels with its picture only, and is limited in length", () => {
  const spec: CustomSpec = { slides: [[1], [2]], edits: { 1: { photo: "0a1b2c3d", photoCredit: "@amsterdamparentproject" }, 2: { photoCredit: "No photo, so no credit" } } };
  const back = decodeSpec(encodeSpec(spec))!;
  assert.equal(back.edits![1].photoCredit, "@amsterdamparentproject");
  assert.equal(back.edits![2], undefined);
  const wire = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  assert.equal(decodeSpec(wire({ s: [[1]], e: { 1: { o: "0a1b2c3d", r: "x".repeat(500) } } }))!.edits![1].photoCredit!.length, SPEC_LIMITS.photoCredit);
});

test("pickEditsFor: a picture and its credit only count on a slide with room for one", () => {
  const spec: CustomSpec = {
    slides: [[1], [2, 3], [4, 5, 6]],
    edits: { 1: { photo: "0a1b2c3d", photoCredit: "@a", title: "T" }, 2: { photo: "0a1b2c3e", photoCredit: "@b" }, 4: { photo: "0a1b2c3f", photoCredit: "@c", blurb: "kept" }, 9: { photo: "0a1b2c40", photoCredit: "@off-slide" } },
  };
  const e = pickEditsFor(spec)!;
  assert.equal(e[1].photoCredit, "@a");
  assert.equal(e[2].photoCredit, "@b");
  assert.equal(e[4].photoCredit, undefined);
  assert.equal(e[4].photo, undefined);
  assert.equal(e[4].blurb, "kept");
  assert.equal(e[9].photoCredit, undefined);
  assert.equal(pickEditsFor(undefined), undefined);
  assert.equal(pickEditsFor({ slides: [[1]] }), undefined);
});

test("empty and malformed input is dropped, never thrown", () => {
  for (const bad of [undefined, null, "", "###", "e30", btoa("not json"), btoa("[1,2]")]) {
    const r = decodeSpec(bad as string | null | undefined);
    assert.ok(r === undefined || Array.isArray(r.slides));
  }
  assert.equal(decodeSpec("###"), undefined);
});

test("limits: slide count, picks per slide, duplicate and non-integer ids, text lengths", () => {
  const wire = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const many = Array.from({ length: 30 }, (_, i) => [i * 10 + 1]);
  assert.equal(decodeSpec(wire({ s: many }))!.slides.length, MAX_CUSTOM_SLIDES);
  assert.deepEqual(decodeSpec(wire({ s: [[1, 2, 3, 4, 5, 6]] }))!.slides, [[1, 2, 3, 4]].map((g) => g.slice(0, MAX_PER_SLIDE)));
  assert.deepEqual(decodeSpec(wire({ s: [[1, 1.5, "x", 2], [2, 3]] }))!.slides, [[1, 2], [3]]);
  const e = decodeSpec(wire({ s: [[1]], e: { 1: { t: "x".repeat(500), c: "y".repeat(500) } } }))!.edits![1];
  assert.equal(e.title!.length, SPEC_LIMITS.title);
  assert.equal(e.group!.length, SPEC_LIMITS.group);
});

test("colors: only 6-digit hex survive", () => {
  const s = decodeSpec(encodeSpec({ slides: [[1]], bgs: ["red"], cover: { bg: "javascript:1" } }));
  assert.ok(!s?.cover?.bg);
  assert.ok(!s?.bgs?.[0]);
});

test("template params round trip, and bad values are ignored", () => {
  const sp = templateParams({ perSlide: 2, heading: "Hi", cta: "Go", sv: "123", spec: { slides: [[1]] } });
  const o = parseTemplate((k) => sp.get(k));
  assert.deepEqual([o.perSlide, o.heading, o.cta, o.sv, o.spec?.slides], [2, "Hi", "Go", "123", [[1]]]);
  const bad = parseTemplate((k) => ({ perSlide: "9", heading: "x".repeat(200), sv: "abc" } as Record<string, string>)[k]);
  assert.equal(bad.perSlide, undefined);
  assert.equal(bad.heading!.length, 60);
  assert.equal(bad.sv, undefined);
  assert.equal(templateParams({}).toString(), "");
});

test("the cover's picture and where it goes survive the round trip; an emptied title stays empty; an address is never accepted", () => {
  const spec: CustomSpec = { slides: [[1]], cover: { title: "", subtitle: "Only a description", photo: "0a1b2c3d", photoMode: "background" } };
  assert.deepEqual(decodeSpec(encodeSpec(spec)), spec);
  const section: CustomSpec = { slides: [[1]], cover: { photo: "0a1b2c3d", photoMode: "section" } };
  assert.equal(decodeSpec(encodeSpec(section))!.cover!.photoMode, "section");
  const wire = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const bad = decodeSpec(wire({ s: [[1]], c: { p: "https://evil.example/x.png", m: "b" } }))!;
  assert.equal(bad.cover!.photo, undefined);
  assert.equal(bad.cover!.photoMode, undefined);
});

test("the cover's corner dandelion survives the round trip, and is absent when off", () => {
  const on: CustomSpec = { slides: [[1]], cover: { puff: true } };
  assert.deepEqual(decodeSpec(encodeSpec(on)), on);
  const off = decodeSpec(encodeSpec({ slides: [[1]], cover: { title: "x", puff: false } }))!;
  assert.equal(off.cover!.puff, undefined);
});

test("choosing no cover picture on purpose survives the round trip, and never alongside a picture", () => {
  assert.equal(decodeSpec(encodeSpec({ slides: [[1]], cover: { noPhoto: true } }))!.cover!.noPhoto, true);
  const both = decodeSpec(encodeSpec({ slides: [[1]], cover: { photo: "0a1b2c3d", photoMode: "section", noPhoto: true } }))!.cover!;
  assert.equal(both.photo, "0a1b2c3d");
  assert.equal(both.noPhoto, undefined);
  assert.equal(decodeSpec(encodeSpec({ slides: [[1]], cover: { title: "Hi" } }))!.cover!.noPhoto, undefined);
});

test("a hand-set Instagram tag travels with the pick; an empty one (remove) is kept; anything that is not a handle is dropped", () => {
  const spec: CustomSpec = { slides: [[1], [2], [3]], edits: { 1: { tag: "justaphase" }, 2: { tag: "" } } };
  const back = decodeSpec(encodeSpec(spec))!;
  assert.equal(back.edits![1].tag, "justaphase");
  assert.equal(back.edits![2].tag, "", "removing the tag found in the link is an edit too");
  const wire = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const raw = decodeSpec(wire({ s: [[1], [2], [3], [4]], e: { 1: { a: "@Some.One" }, 2: { a: "not a handle!" }, 3: { a: 42 }, 4: { a: "x".repeat(40) } } }))!;
  assert.equal(raw.edits![1].tag, "some.one", "cleaned");
  assert.equal(raw.edits?.[2], undefined, "dropped");
  assert.equal(raw.edits?.[3], undefined);
  assert.equal(raw.edits?.[4], undefined, "too long");
});

test("a closing picture and where it goes survive the round trip; an address or a bad id is dropped", () => {
  const back = decodeSpec(encodeSpec({ slides: [[1]], closing: { title: "More", photo: "0a1b2c3d", photoMode: "background" } }));
  assert.equal(back?.closing?.photo, "0a1b2c3d");
  assert.equal(back?.closing?.photoMode, "background");
  const section = decodeSpec(encodeSpec({ slides: [[1]], closing: { photo: "0a1b2c3d" } }));
  assert.equal(section?.closing?.photoMode, "section");
  const bad = decodeSpec(encodeSpec({ slides: [[1]], closing: { title: "x", photo: "https://example.org/a.png", photoMode: "background" } }));
  assert.equal(bad?.closing?.photo, undefined);
  assert.equal(bad?.closing?.photoMode, undefined);
});

test("an address from when hiding tags was a flag of the whole slide hides the tags of that slide's picks", () => {
  const wire = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const spec = decodeSpec(wire({ s: [[1, 2], [3]], h: [1, 0], e: { 2: { t: "Kept" } } }))!;
  assert.equal(spec.edits![1].hideTag, true);
  assert.equal(spec.edits![2].hideTag, true);
  assert.equal(spec.edits![2].title, "Kept");
  assert.equal(spec.edits![3], undefined);
});
