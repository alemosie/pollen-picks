import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { extractIssueImages, extractPageImages, imageId, imageKey, isImageId } from "./images";

const cdn = (opts: string, path: string) => `https://media.beehiiv.com/cdn-cgi/image/${opts}/uploads/asset/file/${path}`;

test("the same picture at another size or cache stamp has the same id", () => {
  const a = cdn("fit=scale-down,quality=80", "abc/kyle.jpg?t=1");
  const b = cdn("width=240,fit=scale-down,quality=80", "abc/kyle.jpg?t=2");
  assert.equal(imageKey(a), imageKey(b));
  assert.equal(imageId(a), imageId(b));
  assert.ok(isImageId(imageId(a)));
  assert.notEqual(imageId(a), imageId(cdn("fit=scale-down", "abc/other.jpg")));
});

test("keeps real pictures in order, once each, and drops pixels, avatars, icons, tiny and non-https images", () => {
  const html = `
    <img alt="Author" width="30" height="30" src="https://media.beehiiv.com/uploads/user/profile_picture/x/thumb.jpg">
    <img alt="Kyle at the park" src="${cdn("fit=scale-down", "a/kyle.jpg?t=1")}">
    <img src="https://example.com/open?id=1" width="1" height="1">
    <img src="http://example.com/insecure.jpg">
    <img src="/relative.jpg">
    <img src="https://example.com/icon.png" width="32" height="32">
    <img src="https://example.com/mark.svg">
    <img alt="Kyle again" src="${cdn("width=300", "a/kyle.jpg?t=2")}">
    <img alt="  Second \n picture " data-src="https://example.com/two.png" width="600">`;
  const found = extractIssueImages(html);
  assert.deepEqual(found.map((i) => i.alt), ["Kyle at the park", "Second picture"]);
  assert.equal(found[1].src, "https://example.com/two.png");
  assert.equal(found[1].width, 600);
});

test("caps the list", () => {
  const html = Array.from({ length: 80 }, (_, i) => `<img src="https://example.com/${i}.jpg">`).join("");
  assert.equal(extractIssueImages(html).length, 40);
});

test("the saved beehiiv page: the two pictures in the body, not the author's avatar", () => {
  const html = readFileSync(join(process.cwd(), "fixtures", "issue-49.web.html"), "utf8");
  const found = extractIssueImages(html);
  assert.equal(found.length, 2);
  assert.ok(found.every((i) => !/profile_picture/.test(i.src)));
});

test("a web page: its preview image first, then its pictures; relative addresses resolve against the page; duplicates and junk are dropped", () => {
  const html = `<html><head>
    <meta property="og:image" content="https://cdn.example.com/cover.jpg?v=3">
    <meta name="twitter:image" content="https://cdn.example.com/cover.jpg?v=4">
    </head><body>
    <img src="/images/hall.jpg" alt="The hall">
    <img src="//cdn.example.com/rooms/one.png" alt="Room">
    <img src="images/relative.jpg">
    <img src="https://cdn.example.com/cover.jpg" alt="again">
    <img src="http://cdn.example.com/insecure.jpg">
    <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
    <img src="https://cdn.example.com/open?x=1" width="1" height="1">
    <img src="https://example.com/avatars/me.jpg">
    </body></html>`;
  const found = extractPageImages(html, "https://venue.example.org/events/12/");
  assert.deepEqual(
    found.map((i) => i.src),
    ["https://cdn.example.com/cover.jpg?v=3", "https://venue.example.org/images/hall.jpg", "https://cdn.example.com/rooms/one.png", "https://venue.example.org/events/12/images/relative.jpg"],
  );
  assert.equal(found[0].alt, "Preview image of the page");
});

test("a page's list is capped at 12 pictures", () => {
  const html = Array.from({ length: 30 }, (_, i) => `<img src="https://example.com/${i}.jpg">`).join("");
  assert.equal(extractPageImages(html, "https://example.com/").length, 12);
});

test("animated GIFs are not offered as pictures (a still slide can't show them), but other pictures are", () => {
  const html = `<img src="https://media.beehiiv.com/cdn-cgi/image/fit=scale-down/uploads/asset/file/abc/pollen_picks.gif?t=1" width="600">
    <img src="https://media.beehiiv.com/uploads/asset/file/def/lantern.jpg" width="600">`;
  assert.deepEqual(extractIssueImages(html).map((i) => i.src.split("/").pop()), ["lantern.jpg"]);
});

test("an issue: beehiiv's thumbnail and the page's og:image come first, then every picture in the body, each once", () => {
  const html = `<html><head><meta property="og:image" content="${cdn("fit=crop", "og/share.jpg")}"></head><body>
    <img alt="Body one" src="${cdn("fit=scale-down", "b/one.jpg?t=1")}">
    <img alt="Body two" src="${cdn("fit=scale-down", "b/two.jpg")}">
    <img alt="Thumb again" src="${cdn("width=300", "th/thumb.jpg")}">
    <img alt="Relative" src="/uploads/rel.png"></body></html>`;
  const found = extractIssueImages(html, { base: "https://news.example.com/p/issue-1", thumbnail: cdn("fit=crop", "th/thumb.jpg?t=9") });
  assert.deepEqual(found.map((i) => i.alt), ["The issue's preview image", "The issue's preview image", "Body one", "Body two", "Relative"]);
  assert.equal(found[0].src, cdn("fit=crop", "th/thumb.jpg?t=9"));
  assert.equal(found[1].src, cdn("fit=crop", "og/share.jpg"));
  assert.equal(found[4].src, "https://news.example.com/uploads/rel.png");
});

test("only the thumbnail and the page's own preview tags are marked as previews, not pictures in the body", () => {
  const html = `<html><head><meta property="og:image" content="${cdn("fit=crop", "og/share.jpg")}"></head><body><img src="${cdn("x=1", "b/one.jpg")}"></body></html>`;
  const found = extractIssueImages(html, { thumbnail: cdn("fit=crop", "th/thumb.jpg") });
  assert.deepEqual(found.map((i) => !!i.preview), [true, true, false]);
  assert.equal(found.find((i) => i.preview)!.src, cdn("fit=crop", "th/thumb.jpg"));
});
