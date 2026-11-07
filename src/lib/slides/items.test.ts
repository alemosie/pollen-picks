import assert from "node:assert/strict";
import { test } from "node:test";
import type { Chunk } from "@/lib/pollen/chunks";
import { captionItemsFor } from "./items";

const chunk = (id: number, url: string | null): Chunk & { rank: number | null } =>
  ({ id, kind: "link", title: `Pick ${id}`, text: "", blurb: "", group: undefined, when: null, place: null, url, rank: null }) as unknown as Chunk & { rank: number | null };
const chunks = [chunk(1, "https://instagram.com/from.link/"), chunk(2, "https://example.com/a"), chunk(3, "https://instagram.com/other.one/")];

test("the caption's tag: from the pick's Instagram link, set by hand, or removed on purpose", () => {
  const tags = (edits?: Parameters<typeof captionItemsFor>[3]) => captionItemsFor(chunks, [1, 2, 3], "2026-11-07", edits).map((c) => c.tag ?? null);
  assert.deepEqual(tags(), ["from.link", null, "other.one"], "as before: only a link to an Instagram account gives a tag");
  assert.deepEqual(tags({ 2: { tag: "by.hand" } }), ["from.link", "by.hand", "other.one"], "a pick that is not from Instagram can be tagged");
  assert.deepEqual(tags({ 1: { tag: "changed" } }), ["changed", null, "other.one"], "replaces the one from the link");
  assert.deepEqual(tags({ 3: { tag: "" } }), ["from.link", null, null], "an empty tag removes the one from the link");
});
