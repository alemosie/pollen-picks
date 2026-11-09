import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_TEMPLATE_CHARS, cleanFormat, isCreationId, keepStoredCaptions, isSavableSource, parseCreationInput, type CreationInput } from "./savedCreationShape";

const PUB = "pub_00000000-0000-0000-0000-000000000001";
const POST = "post_00000000-0000-0000-0000-000000000002";
const own = `own:${PUB}:${POST}`;
const link = "https://example.com/issue-1";
const template = "spec=abc&sv=1";
const sig = `${link}|1,2,3|${template}`;
const ok = (b: Record<string, unknown>) => {
  const r = parseCreationInput({ source: own, link, picks: [1, 2, 3], template, step: 4, newsletter: "N", title: "T", ...b });
  assert.ok(!("error" in r), "error" in r ? r.error : "");
  return r as CreationInput;
};
const bad = (b: Record<string, unknown>) => {
  const r = parseCreationInput({ source: own, link, picks: [1, 2, 3], template, ...b });
  assert.ok("error" in r, "expected an error");
  return (r as { error: string }).error;
};

test("only a source that names one issue can be saved", () => {
  assert.equal(isSavableSource(own), true);
  assert.equal(isSavableSource("link:00000000-0000-0000-0000-000000000003"), true);
  assert.equal(isSavableSource("own"), false, "plain own means 'the newest issue', which changes");
  assert.equal(isSavableSource("demo"), false);
  assert.equal(isSavableSource(""), false);
  assert.match(bad({ source: "own" }), /single issue/);
});

test("picks must be there, whole numbers, and are kept once each in order", () => {
  assert.deepEqual(ok({ picks: [3, 1, 3, 2, 1] }).picks, [3, 1, 2]);
  assert.deepEqual(ok({ picks: [1, "x", 2.5, -1, null, 4] }).picks, [1, 4]);
  assert.match(bad({ picks: [] }), /Pick something/);
  assert.match(bad({ picks: "1,2" }), /Pick something/);
  assert.match(bad({ picks: Array.from({ length: 201 }, (_, i) => i) }), /too many/);
});

test("a design too large to store is refused", () => {
  assert.match(bad({ template: "x".repeat(MAX_TEMPLATE_CHARS + 1) }), /too large/);
  assert.equal(ok({ template: "x".repeat(MAX_TEMPLATE_CHARS) }).template.length, MAX_TEMPLATE_CHARS);
  assert.equal(ok({ template: "x".repeat(4001) }).template.length, 4001, "a design past the old 4,000 limit is kept whole");
});

test("step is Write (4) unless it says Design (3) or Send (5)", () => {
  assert.equal(ok({ step: 5 }).step, 5);
  assert.equal(ok({ step: 4 }).step, 4);
  assert.equal(ok({ step: 3 }).step, 3, "Design");
  assert.equal(ok({ step: 99 }).step, 4);
  assert.equal(ok({ step: undefined }).step, 4);
});

test("the caption state is kept only when it is for exactly these picks and this design", () => {
  const format = { sig, order: "clicks", edited: { instagram: "my words" }, tab: "instagram" };
  assert.deepEqual(ok({ format }).format, format);
  assert.equal(ok({ format: { ...format, sig: `${link}|1,2|${template}` } }).format, null, "other picks");
  assert.equal(ok({ format: { ...format, sig: `${link}|1,2,3|spec=other` } }).format, null, "other design");
  assert.equal(ok({ format: { ...format, sig: `https://other|1,2,3|${template}` } }).format, null, "other issue");
  assert.equal(ok({}).format, null);
});

test("cleanFormat drops what Write never writes", () => {
  const f = cleanFormat({ sig: "s", order: "alpha", tab: "nonsense", edited: { instagram: "a", bogus: "b", link: 5 }, extra: true });
  assert.deepEqual(f, { sig: "s", order: "alpha", tab: "instagram", edited: { instagram: "a" } });
  assert.equal(cleanFormat(null), null);
  assert.equal(cleanFormat([]), null);
  assert.equal(cleanFormat({ sig: 1, order: "x", tab: "link" }), null);
  assert.equal(cleanFormat({ sig: "s", order: "x", tab: "link", edited: { instagram: "x".repeat(41_000) } }), null, "too large to keep");
});

test("title, newsletter and link are cut to what the table allows", () => {
  const r = ok({ title: "t".repeat(500), newsletter: "n".repeat(500) });
  assert.equal(r.title.length, 300);
  assert.equal(r.newsletter.length, 200);
});

test("only a real row id opens or deletes anything", () => {
  assert.equal(isCreationId("3f2b8c1e-5d4a-4b7e-9c1f-0a1b2c3d4e5f"), true);
  assert.equal(isCreationId("1; drop table saved_creations"), false);
  assert.equal(isCreationId(undefined), false);
});

import { decideRunWrite, sameCreation } from "./savedCreationShape";

const base = { source: own, picks: [1, 2, 3], template, format: { sig, order: "clicks", edited: { instagram: "a", link: "b" }, tab: "instagram" } };

test("a run equals its saved copy when issue, picks in order, design and every caption match", () => {
  assert.equal(sameCreation(base, { ...base, format: { ...base.format, edited: { link: "b", instagram: "a" } } }), true, "key order does not matter");
  assert.equal(sameCreation(base, { ...base, picks: [3, 2, 1] }), false, "pick order matters");
  assert.equal(sameCreation(base, { ...base, template: "spec=x" }), false);
  assert.equal(sameCreation(base, { ...base, source: "link:00000000-0000-0000-0000-000000000003" }), false);
  assert.equal(sameCreation(base, { ...base, format: { ...base.format, edited: { instagram: "changed", link: "b" } } }), false, "an edited caption is unsaved work");
  assert.equal(sameCreation(base, { ...base, format: { ...base.format, edited: { instagram: "a" } } }), false);
  assert.equal(sameCreation(base, { ...base, format: null }), false);
  assert.equal(sameCreation({ ...base, format: null }, { ...base, format: null }), true);
});

test("the run slot: an empty slot is written, a different issue takes it, the same issue needs what the writer last saw", () => {
  const existing = { source: own, updatedAt: "2026-11-07T08:00:00.123Z" };
  const w = (o: Partial<Parameters<typeof decideRunWrite>[0]>) => decideRunWrite({ existing, source: own, ifUpdatedAt: null, force: false, ...o });
  assert.equal(w({ existing: null }), "write", "nothing there yet");
  assert.equal(w({ ifUpdatedAt: "2026-11-07T08:00:00.123Z" }), "write", "the writer saw the latest");
  assert.equal(w({ ifUpdatedAt: "2026-11-07T09:00:00.123+01:00" }), "write", "same moment, written another way");
  assert.equal(w({ ifUpdatedAt: "2026-11-07T07:59:00.000Z" }), "conflict", "another device wrote since");
  assert.equal(w({ ifUpdatedAt: null }), "conflict", "same issue, writer has seen nothing: it may not overwrite");
  assert.equal(w({ ifUpdatedAt: null, source: "link:00000000-0000-0000-0000-000000000003" }), "write", "a new run on another issue takes the slot");
  assert.equal(w({ ifUpdatedAt: "2026-11-07T07:59:00.000Z", force: true }), "write", "'use this screen'");
  assert.equal(w({ ifUpdatedAt: null, sameContent: true }), "write", "holds exactly what is stored (cleared storage, same state): nothing to ask");
  assert.equal(w({ ifUpdatedAt: "2026-11-07T07:59:00.000Z", sameContent: true }), "write");
});

test("a run can be at Pick; a saved creation can't", () => {
  assert.equal((parseCreationInput({ source: own, picks: [1], template: "", step: 2 }, [2, 3, 4, 5]) as CreationInput).step, 2);
  assert.equal((parseCreationInput({ source: own, picks: [1], template: "", step: 2 }) as CreationInput).step, 4, "saved: falls back to Write");
});

test("keepStoredCaptions keeps stored captions the writer lacks, but never overrides its own", () => {
  const stored = { sig: "l|1,2|spec=x&sv=1", order: "date", tab: "instagram", edited: { instagram: "mine", facebook: "fb" } };
  const none = { sig: "l|1,2|spec=x&sv=2", order: "date", tab: "instagram", edited: {} };
  assert.deepEqual(keepStoredCaptions(stored, none)!.edited, { instagram: "mine", facebook: "fb" });
  assert.equal(keepStoredCaptions(stored, none)!.sig, none.sig);
  const own = { ...none, edited: { instagram: "newer" } };
  assert.deepEqual(keepStoredCaptions(stored, own)!.edited, { instagram: "newer", facebook: "fb" });
  assert.deepEqual(keepStoredCaptions(stored, { ...none, sig: "l|1,3|spec=x" })!.edited, {});
  assert.equal(keepStoredCaptions(null, none), none);
});
