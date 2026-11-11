import assert from "node:assert/strict";
import { test } from "node:test";
import { meterText } from "./demoHighlights";

// The tray's line in the demo. The word limit is only about highlighted text, so it appears once there is some.
test("meterText: picks only, while nothing is highlighted", () => {
  assert.equal(meterText({ count: 5, maxCount: 5, words: 0, maxWords: 250 }), "5/5 picks");
});

test("meterText: adds the highlighted words once there are some", () => {
  assert.equal(meterText({ count: 2, maxCount: 5, words: 42, maxWords: 250 }), "2/5 picks, 42/250 highlighted words");
});
