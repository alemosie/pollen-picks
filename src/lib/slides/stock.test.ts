import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeSpec, encodeSpec } from "./options";
import { isStockId, STOCK, STOCK_IMAGES, stockSvg } from "./stock";
import { isImageId } from "@/lib/pollen/imageIds";

test("every built-in picture has a valid picture id, so a design can carry it, and a real SVG", () => {
  for (const s of STOCK) {
    assert.ok(isImageId(s.id) && isStockId(s.id));
    assert.ok(stockSvg(s.id)!.startsWith("<svg"));
    assert.ok(STOCK_IMAGES.some((i) => i.id === s.id && i.src.startsWith("data:image/svg+xml")));
  }
  assert.equal(isStockId("0a1b2c3d"), false);
  const spec = { slides: [[1]], cover: { photo: STOCK[0].id, photoMode: "background" as const } };
  assert.deepEqual(decodeSpec(encodeSpec(spec)), spec);
});
