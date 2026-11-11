import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { captionFitState, fitIssues } from "./channelFit";

// What the Send step's alert triangle says. Slides: a network with a smaller carousel takes only the first ones. Caption: over the network's
// character limit, or more @tags than Instagram allows. Nothing to say means no triangle.
const short = "A short caption";

describe("fitIssues", () => {
  test("everything fits: nothing to warn about", () => {
    for (const s of ["instagram", "linkedin", "facebook", "threads", "bluesky", "mastodon", "twitter"]) assert.deepEqual(fitIssues(s, { slideCount: 3, caption: short }), [], s);
  });
  test("more slides than the network takes: only the first ones are posted", () => {
    assert.deepEqual(fitIssues("bluesky", { slideCount: 6, caption: short }), ["It takes only the first 4 of your 6 slides."]);
    assert.deepEqual(fitIssues("instagram", { slideCount: 10, caption: short }), []);
    assert.deepEqual(fitIssues("instagram", { slideCount: 11, caption: short }), ["It takes only the first 10 of your 11 slides."]);
    assert.deepEqual(fitIssues("linkedin", { slideCount: 11, caption: short }), []);
  });
  test("a caption over the limit says by how much, and that Send now makes a draft", () => {
    const issues = fitIssues("threads", { slideCount: 3, caption: "x".repeat(520) });
    assert.deepEqual(issues, ["The caption is 20 characters over its limit of 500.", "Send now saves it as a draft to shorten in Buffer."]);
  });
  test("too many @tags on Instagram", () => {
    const tags = Array.from({ length: 22 }, (_, i) => `@user${i}`).join(" ");
    const issues = fitIssues("instagram", { slideCount: 3, caption: tags });
    assert.match(issues[0], /^The caption has 2 @tags too many \(the limit is 20\)\.$/);
    assert.equal(issues.at(-1), "Send now saves it as a draft to shorten in Buffer.");
  });
  test("slides and caption together: both are listed", () => {
    const issues = fitIssues("bluesky", { slideCount: 5, caption: "y".repeat(310) });
    assert.equal(issues.length, 3);
    assert.match(issues[0], /first 4 of your 5 slides/);
    assert.match(issues[1], /10 characters over its limit of 300/);
  });
  test("the Send now note is only for a caption problem", () => {
    assert.ok(!fitIssues("bluesky", { slideCount: 9, caption: short }).some((i) => i.includes("Send now")));
  });
});

// The line for a network under "Fits on" on Write. A caption trimmed to fit (picks left out) must not read as a plain "fits".
describe("captionFitState", () => {
  test("a caption that fits whole is a check", () => {
    assert.deepEqual(captionFitState("twitter", short, 0), { state: "fits", label: null });
  });
  test("a caption that fits only because picks were left out is not a check, and says how many", () => {
    assert.deepEqual(captionFitState("twitter", short, 1), { state: "cut", label: "1 pick left out" });
    assert.deepEqual(captionFitState("twitter", short, 3), { state: "cut", label: "3 picks left out" });
  });
  test("a caption over the limit says by how much (that wins over picks left out)", () => {
    assert.deepEqual(captionFitState("threads", "x".repeat(520), 0), { state: "over", label: "over by 20" });
    assert.equal(captionFitState("threads", "x".repeat(520), 2).state, "over");
  });
  test("too many @tags on Instagram says how many", () => {
    const tags = Array.from({ length: 22 }, (_, i) => `@user${i}`).join(" ");
    assert.deepEqual(captionFitState("instagram", tags, 0), { state: "tags", label: "2 too many tags" });
  });
});
