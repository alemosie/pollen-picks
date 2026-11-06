import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { parseChunks } from "./chunks";
import { contentRoot } from "./content";

test("flat editor HTML is returned untouched", () => {
  const html = "<h2>A</h2><p>Some text that is long enough.</p>";
  assert.equal(contentRoot(html), html);
});

test("blocks wrapped in divs inside #content-blocks are lifted out", () => {
  const out = contentRoot(`<html><body><div id="content-blocks"><div class="b"><h2>Hello</h2></div><div class="b"><p>A paragraph of real text here.</p></div></div></body></html>`);
  assert.ok(out.includes("<h2>Hello</h2>") && out.includes("<p>A paragraph of real text here.</p>"));
  assert.ok(!out.includes("class="));
});

test("beehiiv's <i> and <b> become <em> and <strong>", () => {
  const out = contentRoot(`<div id="content-blocks"><div><p><i>when</i> and <b>what</b> and some text</p></div></div>`);
  assert.ok(out.includes("<em>when</em>") && out.includes("<strong>what</strong>"), out);
});

test("images and their captions, navigation and footers are left out", () => {
  const out = contentRoot(
    `<div id="content-blocks"><nav><p>Menu menu menu menu menu</p></nav><div><img src="https://x.com/a.png"><p>A caption for the picture</p></div><div><p>${"The real text of the post, long enough. ".repeat(8)}</p></div><footer><p>Footer footer footer footer</p></footer></div>`,
  );
  assert.ok(out.includes("The real text"));
  assert.ok(!out.includes("caption") && !out.includes("Menu") && !out.includes("Footer"), out);
});

test("without #content-blocks, the element holding the most blocks is the post", () => {
  const out = contentRoot(`<html><body><div><p>Sidebar text that is a little long.</p></div><main><h2>One</h2><p>Paragraph one of the post is here.</p><p>Paragraph two of the post is here.</p></main></body></html>`);
  assert.ok(out.includes("Paragraph two") && !out.includes("Sidebar"), out);
});

test("a post built from plain divs (cards) becomes headings, paragraphs and lists", () => {
  const html = readFileSync(join(process.cwd(), "fixtures", "wellybuzz-issue.web.html"), "utf8");
  const chunks = parseChunks(contentRoot(html));
  assert.ok(chunks.length > 50, `expected many chunks from the card layout, got ${chunks.length}`);
  assert.ok(chunks.some((c) => c.kind === "bullet" && c.url), "cards become linked list items");
});
