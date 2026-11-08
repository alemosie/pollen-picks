import assert from "node:assert/strict";
import { test } from "node:test";
import { captionFileNames, extFor, slideFileName, slug } from "./demoDownload";

test("slides are numbered from 1, padded only when there are ten or more", () => {
  assert.equal(slideFileName(0, 5, "png"), "slide-1.png");
  assert.equal(slideFileName(4, 5, "png"), "slide-5.png");
  assert.equal(slideFileName(0, 12, "png"), "slide-01.png");
  assert.equal(slideFileName(11, 12, "webp"), "slide-12.webp");
});

test("caption files are named for their networks, and never collide", () => {
  assert.deepEqual(captionFileNames(["Instagram", "LinkedIn and Facebook", "X"]), [
    "caption-instagram.txt",
    "caption-linkedin-and-facebook.txt",
    "caption-x.txt",
  ]);
  assert.deepEqual(captionFileNames(["X", "X"]), ["caption-x.txt", "caption-x-2.txt"]);
  assert.equal(slug("¡¿?!"), "caption");
});

test("the extension follows what the slide route sent", () => {
  assert.equal(extFor("image/png"), "png");
  assert.equal(extFor("image/webp"), "webp");
  assert.equal(extFor("image/jpeg"), "jpg");
  assert.equal(extFor(null), "png");
});
