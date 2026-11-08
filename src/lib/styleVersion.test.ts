import assert from "node:assert/strict";
import { test } from "node:test";
import { newerVersion } from "./styleVersion";

test("keeps the server's version when Settings left nothing", () => {
  assert.equal(newerVersion("100", null), "100");
  assert.equal(newerVersion(undefined, null), undefined);
});
test("takes the browser's when Settings changed the style after the page was drawn", () => {
  assert.equal(newerVersion("100", "250"), "250");
  assert.equal(newerVersion(undefined, "250"), "250");
});
test("keeps the server's when it is newer (another device saved later)", () => {
  assert.equal(newerVersion("300", "250"), "300");
});
