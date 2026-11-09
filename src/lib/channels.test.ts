import { test } from "node:test";
import assert from "node:assert/strict";
import { imageLimit } from "./channels";

// Buffer's help page "Attaching images, videos, and other media to your posts" (and its API refusals) set these.
test("image limits per network match Buffer's", () => {
  const want: Record<string, number> = { instagram: 10, facebook: 10, threads: 10, linkedin: 20, twitter: 4, bluesky: 4, mastodon: 4 };
  for (const [s, n] of Object.entries(want)) assert.equal(imageLimit(s), n, s);
  assert.equal(imageLimit("somethingnew"), 10);
});
