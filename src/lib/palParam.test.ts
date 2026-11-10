import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PALETTE, palFromParam, palParam } from "./palette";
import { parseTemplateFrom, templateParams } from "./slides/options";

test("the standard palette adds nothing to an address", () => {
  assert.equal(palParam(DEFAULT_PALETTE), undefined);
});

test("a palette goes into an address and comes back out", () => {
  const colors = ["#ffffff", "#5C3D2E", "#b5532a"];
  const p = palParam(colors);
  assert.equal(p, "ffffff-5c3d2e-b5532a");
  assert.deepEqual(palFromParam(p), ["#ffffff", "#5c3d2e", "#b5532a"]);
});

test("anything else in the address is ignored", () => {
  for (const v of [undefined, null, "", "ffffff", "zzzzzz-ffffff", "ffffff-ffffff-", "fff-fff", "ffffff-ffffff-ffffff-ffffff-ffffff-ffffff-ffffff-ffffff-ffffff", "ffffff,ffffff"]) assert.equal(palFromParam(v), null);
});

test("the palette travels with the template", () => {
  const q = templateParams({ pal: "ffffff-5c3d2e" });
  assert.equal(q.get("pal"), "ffffff-5c3d2e");
  assert.equal(parseTemplateFrom(q).pal, "ffffff-5c3d2e");
  assert.equal(parseTemplateFrom(new URLSearchParams("pal=nope")).pal, undefined);
});
