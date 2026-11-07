import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanStyle, DEFAULT_STYLE, SLOTS } from "./style";

test("the standard look: nothing top left, publication bottom left, organization bottom right", () => {
  assert.equal(DEFAULT_STYLE.top, "none");
  assert.equal(DEFAULT_STYLE.bottom, "publication");
  assert.equal(DEFAULT_STYLE.bottomRight, "organization");
});

test("every corner can show the attribution, or nothing", () => {
  assert.ok(SLOTS.includes("attribution"));
  const s = cleanStyle({ top: "attribution", bottom: "none", bottomRight: "attribution" }, DEFAULT_STYLE)!;
  assert.deepEqual([s.top, s.bottom, s.bottomRight], ["attribution", "none", "attribution"]);
});

test("a field left out keeps its saved value; a bad one refuses the whole style", () => {
  assert.equal(cleanStyle({ font: "dmsans" }, DEFAULT_STYLE)!.bottomRight, "organization");
  assert.equal(cleanStyle({ bottomRight: "nonsense" }, DEFAULT_STYLE), null);
});
