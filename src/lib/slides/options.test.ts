import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeSpec, encodeSpec, MAX_CUSTOM_SLIDES, MAX_PER_SLIDE, parseTemplate, SPEC_LIMITS, templateParams, type CustomSpec } from "./options";

test("a spec survives the round trip, including the category label and unicode", () => {
  const spec: CustomSpec = {
    cover: { title: "Dit weekend 🎃", subtitle: "Café picks", bg: "#f6bd60" },
    closing: { title: "More", line: "Read on", cta: "Go", bg: "#112233" },
    slides: [[1, 2], [3]],
    bgs: ["#aabbcc", ""],
    hideTags: [false, true],
    edits: { 2: { title: "Ñandú", when: "Sat", place: "Park", blurb: "Fun", group: "West", bg: "#010203" } },
  };
  assert.deepEqual(decodeSpec(encodeSpec(spec)), spec);
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
