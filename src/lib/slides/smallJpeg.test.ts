import assert from "node:assert/strict";
import { describe, test } from "node:test";
import "../../test/setup";
import { SMALL_IMAGE_BYTES, toSmallJpeg } from "./render";

// A slide for a network with a hard size limit (Bluesky: 1 MB) has to come out under it, as a real JPEG, whatever the picture is like.

async function noisyPng(w: number, h: number) {
  const { default: sharp } = await import("sharp");
  const raw = Buffer.alloc(w * h * 3);
  let x = 123456789;
  for (let i = 0; i < raw.length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff; // deterministic grain
    // a gradient with grain, like a photo: big as a PNG (the grain can't be packed), but a JPEG handles it
    raw[i] = (Math.floor(i / 3) % w) / 6 + ((x >> 16) & 0x1f);
  }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

describe("toSmallJpeg", () => {
  test("a flat slide becomes a small JPEG", async () => {
    const { default: sharp } = await import("sharp");
    const png = await sharp({ create: { width: 1080, height: 1350, channels: 3, background: "#f6bd60" } }).png().toBuffer();
    const out = await toSmallJpeg(png);
    assert.ok(out && out.length < 100_000, String(out?.length));
    assert.deepEqual([...out!.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  });
  test("a photo-heavy slide (a PNG of several MB) comes out under the limit", async () => {
    const png = await noisyPng(1080, 1350);
    assert.ok(png.length > 2_000_000, `the test picture is big: ${png.length}`);
    const out = await toSmallJpeg(png);
    assert.ok(out, "a result");
    assert.ok(out.length <= SMALL_IMAGE_BYTES, `${out.length} bytes`);
    assert.deepEqual([...out.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  });
  test("a limit nothing can meet gives null, so the caller serves the PNG instead of a broken file", async () => {
    assert.equal(await toSmallJpeg(await noisyPng(1080, 1350), 100), null);
  });
  test("even pure noise (nothing real looks like it) ends under the limit or null, never an oversized file", async () => {
    const { default: sharp } = await import("sharp");
    const raw = Buffer.alloc(1080 * 1350 * 3);
    let x = 7;
    for (let i = 0; i < raw.length; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      raw[i] = x >> 16;
    }
    const out = await toSmallJpeg(await sharp(raw, { raw: { width: 1080, height: 1350, channels: 3 } }).png().toBuffer());
    assert.ok(out === null || out.length <= SMALL_IMAGE_BYTES);
  });
  test("bytes that are not an image give null, not an exception", async () => {
    assert.equal(await toSmallJpeg(Buffer.from("not an image")), null);
  });
  test("transparent areas become white, not black", async () => {
    const { default: sharp } = await import("sharp");
    const png = await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const out = await toSmallJpeg(png);
    const { data } = await sharp(out!).raw().toBuffer({ resolveWithObject: true });
    assert.ok(data[0] > 240 && data[1] > 240 && data[2] > 240);
  });
});
