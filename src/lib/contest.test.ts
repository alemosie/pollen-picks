import assert from "node:assert/strict";
import { test } from "node:test";
import { feedbackOpen } from "./contest";

test("the feedback prompt and banner show until 12 Nov 00:00 in Amsterdam and are gone from then on", () => {
  assert.equal(feedbackOpen(Date.parse("2026-11-07T10:00:00+01:00")), true);
  assert.equal(feedbackOpen(Date.parse("2026-11-11T23:59:59+01:00")), true, "the last second of 11 Nov");
  assert.equal(feedbackOpen(Date.parse("2026-11-12T00:00:00+01:00")), false, "midnight into 12 Nov");
  assert.equal(feedbackOpen(Date.parse("2026-11-13T12:00:00+01:00")), false);
});
