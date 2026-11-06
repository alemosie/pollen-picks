import assert from "node:assert/strict";
import { test } from "node:test";
import { checkPhotoLink } from "./userPhotoLinks";

test("a normal picture link is accepted and cleaned", () => {
  assert.deepEqual(checkPhotoLink("https://example.com/a/b.webp"), { url: "https://example.com/a/b.webp" });
  assert.deepEqual(checkPhotoLink("  example.com/p.jpg#top "), { url: "https://example.com/p.jpg" });
  assert.deepEqual(checkPhotoLink("http://example.com/p.jpg"), { url: "https://example.com/p.jpg" });
});

test("anything that is not a public https address is refused", () => {
  for (const bad of ["", "   ", null, 42, "ftp://example.com/p.jpg", "javascript:alert(1)", "data:image/png;base64,AAAA", "https://user:pw@example.com/p.jpg", "https://example.com:8443/p.jpg", "https://localhost/p.jpg", "https://127.0.0.1/p.jpg", "https://[::1]/p.jpg", "not a link"])
    assert.ok("error" in checkPhotoLink(bad), String(bad));
});

test("a very long address is refused", () => {
  assert.ok("error" in checkPhotoLink(`https://example.com/${"a".repeat(1100)}`));
});
