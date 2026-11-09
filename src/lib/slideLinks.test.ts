import "../test/setup";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SLIDE_LINK_DAYS, SLIDE_WARN_AFTER_DAYS, slideLinkState } from "./slideLinks";
import { signPreview, verifyPreview } from "./previewSig";

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-20T12:00:00Z");
const draft = (daysAgo: number, over: Partial<{ mode: string; status: string }> = {}) => ({
  mode: "draft",
  status: "draft",
  createdAt: new Date(NOW - daysAgo * DAY).toISOString(),
  ...over,
});

describe("slideLinkState", () => {
  it("is fine for a fresh draft", () => {
    assert.equal(slideLinkState(draft(0), NOW), "ok");
    assert.equal(slideLinkState(draft(9), NOW), "ok");
  });

  it("warns once a draft is more than 10 days old", () => {
    assert.equal(slideLinkState(draft(SLIDE_WARN_AFTER_DAYS), NOW), "ok", "exactly 10 days is not yet more than 10");
    assert.equal(slideLinkState(draft(SLIDE_WARN_AFTER_DAYS + 0.01), NOW), "soon");
    assert.equal(slideLinkState(draft(13), NOW), "soon");
  });

  it("calls a draft expired once it is more than 14 days old", () => {
    assert.equal(slideLinkState(draft(SLIDE_LINK_DAYS), NOW), "soon", "exactly 14 days: the link is still valid");
    assert.equal(slideLinkState(draft(SLIDE_LINK_DAYS + 0.01), NOW), "expired");
    assert.equal(slideLinkState(draft(60), NOW), "expired");
  });

  it("leaves everything that is not a draft in Buffer alone", () => {
    for (const status of ["sent", "scheduled", "sending", "error", "needs_approval", "failed", "unknown", "queued", "working"]) {
      assert.equal(slideLinkState(draft(30, { status }), NOW), "ok", status);
    }
    assert.equal(slideLinkState(draft(30, { mode: "now" }), NOW), "ok", "a publish-now post has had its images fetched");
  });

  it("says nothing before the browser clock is known, or for a date it can't read", () => {
    assert.equal(slideLinkState(draft(30), null), "ok");
    assert.equal(slideLinkState({ mode: "draft", status: "draft", createdAt: "not a date" }, NOW), "ok");
  });

  it("is the same length of time the signed links really last", () => {
    process.env.SESSION_SECRET ||= "x".repeat(40);
    const params = new URLSearchParams({ issue: "49" });
    const signed = signPreview(params, "user-1", NOW);
    assert.equal(verifyPreview(signed, NOW + SLIDE_LINK_DAYS * DAY - 1000), "user-1", "still valid just before the warning's own 14 days");
    assert.equal(verifyPreview(signed, NOW + SLIDE_LINK_DAYS * DAY + 1000), null, "refused just after");
  });
});
