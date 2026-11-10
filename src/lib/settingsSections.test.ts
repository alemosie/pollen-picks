import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { resolveSection } from "./settingsSections";

const IDS = ["newsletter", "brand", "instagram", "linkedin", "photos", "account"];

describe("settings sections", () => {
  test("a known section opens itself", () => {
    assert.equal(resolveSection("linkedin", IDS), "linkedin");
    assert.equal(resolveSection(["photos", "x"], IDS), "photos");
  });
  test("the three old names open Brand, so saved and shared links still land somewhere right", () => {
    for (const old of ["organization", "style", "colors"]) assert.equal(resolveSection(old, IDS), "brand");
  });
  test("nothing, or something unknown, opens the first section", () => {
    assert.equal(resolveSection(undefined, IDS), "newsletter");
    assert.equal(resolveSection("", IDS), "newsletter");
    assert.equal(resolveSection("nope", IDS), "newsletter");
    assert.equal(resolveSection("constructor", IDS), "newsletter", "a name that is only on Object's prototype is not a section");
  });
});
