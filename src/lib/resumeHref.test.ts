import test from "node:test";
import assert from "node:assert/strict";
import { resumeHref } from "./progress";

test("resumes an app step, with its query", () => {
  assert.equal(resumeHref("/design?x=1"), "/design?x=1");
});
test("falls back to the first step", () => {
  for (const h of [undefined, null, "", "/settings", "/settings?section=brand", "//evil.com", "https://evil.com", "design"]) assert.equal(resumeHref(h), "/source");
});
