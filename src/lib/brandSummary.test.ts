import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { brandSummary } from "./brandSummary";
import { DEFAULT_PALETTE } from "./palette";

const LOGO = "data:image/png;base64,AAAA";

describe("the Your brand strip", () => {
  test("nothing set up: the Pollen Picks colors, and no brand", () => {
    const b = brandSummary(DEFAULT_PALETTE, { name: "", logo: null });
    assert.equal(b.set, false);
    assert.deepEqual(b.palette, DEFAULT_PALETTE);
    assert.equal(b.logo, null);
  });
  test("no brand info at all (the demo) reads as nothing set", () => {
    assert.equal(brandSummary(DEFAULT_PALETTE, undefined).set, false);
  });
  test("the same colors in capitals are still the standard ones", () => {
    assert.equal(brandSummary(DEFAULT_PALETTE.map((c) => c.toUpperCase()), undefined).set, false);
  });
  test("the organization beehiiv gives is shown as the name but does not count as set up", () => {
    const b = brandSummary(DEFAULT_PALETTE, { name: "", fallbackName: "Amsterdam Parent Project", logo: null });
    assert.equal(b.set, false);
    assert.equal(b.name, "Amsterdam Parent Project");
  });
  test("your own palette, logo or name each make it set", () => {
    assert.equal(brandSummary(["#112233", "#445566"], { name: "", logo: null }).set, true);
    assert.equal(brandSummary(DEFAULT_PALETTE, { name: "", logo: LOGO }).set, true);
    assert.equal(brandSummary(DEFAULT_PALETTE, { name: "  Just a   Phase ", logo: null }).set, true);
  });
  test("a saved name wins over the one from beehiiv, and is tidied", () => {
    assert.equal(brandSummary(DEFAULT_PALETTE, { name: "  Just a   Phase ", fallbackName: "Other", logo: null }).name, "Just a Phase");
  });
  test("a palette of the same length but another color is yours", () => {
    const mine = [...DEFAULT_PALETTE.slice(0, -1), "#123456"];
    assert.equal(brandSummary(mine, undefined).set, true);
  });
});
