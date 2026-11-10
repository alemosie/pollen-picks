import test from "node:test";
import assert from "node:assert/strict";
import { colorsFromPalette, contrast, DEFAULT_COLORS, textOn } from "./brand";
import { DEFAULT_PALETTE } from "./palette";

test("no palette or the standard one gives the standard colors", () => {
  assert.equal(colorsFromPalette(null), DEFAULT_COLORS);
  assert.equal(colorsFromPalette(DEFAULT_PALETTE), DEFAULT_COLORS);
});

test("a custom palette fills the roles in order and picks readable text", () => {
  const c = colorsFromPalette(["#ffffff", "#5c3d2e", "#b5532a", "#1f4e4e", "#8a7f72", "#b8f2d0", "#ffffff"]);
  assert.equal(c.background, "#ffffff");
  assert.equal(c.accent, "#5c3d2e");
  assert.equal(c.card, "#b5532a");
  assert.equal(c.chip, "#1f4e4e");
  assert.equal(c.highlight, "#8a7f72");
  assert.ok(contrast(c.text, c.background) >= 4.5);
});

test("a short palette keeps the standard colors for the roles it doesn't fill", () => {
  const c = colorsFromPalette(["#111111", "#eeeeee"]);
  assert.equal(c.card, DEFAULT_COLORS.card);
  assert.equal(c.background, "#111111");
});

test("text on a surface keeps the kit's ink when it reads, and otherwise picks the best of ink, dark and cream", () => {
  const dark = DEFAULT_COLORS.text;
  assert.equal(textOn("#f5cac3", dark), dark); // the standard card
  assert.equal(textOn("#64411b", dark), DEFAULT_COLORS.background); // dark brown: cream
  assert.equal(textOn("#ffffff", "#f7ede2"), dark); // a light kit ink on a white card: dark text
  assert.equal(textOn("#64411b", "#f7ede2"), "#f7ede2"); // a light ink that reads is kept
});
