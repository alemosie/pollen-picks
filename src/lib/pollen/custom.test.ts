import assert from "node:assert/strict";
import { test } from "node:test";
import { CUSTOM_BASE, cleanHighlight, cleanHighlightUrl, cleanLinkText, customChunk, isCustomId, parseHighlight } from "./custom";

test("cleanHighlight tidies spaces and keeps single line breaks", () => {
  assert.equal(cleanHighlight("  Hello    world  "), "Hello world");
  assert.equal(cleanHighlight("Title line  \n   Description here"), "Title line\nDescription here");
});
test("cleanHighlight rejects what is unusable", () => {
  assert.equal(cleanHighlight("a"), null);
  assert.equal(cleanHighlight("   "), null);
  assert.equal(cleanHighlight(42), null);
  assert.equal(cleanHighlight("x".repeat(2001)), null);
  assert.equal(cleanHighlight("x".repeat(2000))?.length, 2000);
});

test("cleanLinkText needs a link and must be part of the highlight", () => {
  assert.equal(cleanLinkText("prior post", "In our prior post, we wrote", "https://x.com"), "prior post");
  assert.equal(cleanLinkText("prior post", "In our prior post, we wrote", null), null);
  assert.equal(cleanLinkText("something else", "In our prior post, we wrote", "https://x.com"), null);
  assert.equal(cleanLinkText("x".repeat(201), "x".repeat(300), "https://x.com"), null);
});

test("cleanHighlightUrl accepts one http(s) link", () => {
  assert.equal(cleanHighlightUrl(" https://x.com/a "), "https://x.com/a");
  assert.equal(cleanHighlightUrl("javascript:alert(1)"), null);
  assert.equal(cleanHighlightUrl("https://x.com/a b"), null);
  assert.equal(cleanHighlightUrl("ftp://x.com"), null);
  assert.equal(cleanHighlightUrl(`https://x.com/${"a".repeat(1000)}`), null);
});

test("with a link: its text is the title and the rest is the description", () => {
  assert.deepEqual(parseHighlight("Big Fair – a day of fun for all", "Big Fair"), { title: "Big Fair", description: "a day of fun for all" });
  assert.deepEqual(parseHighlight("Join the Big Fair: a day of fun", "Big Fair"), { title: "Big Fair", description: "Join the Big Fair: a day of fun" });
});
test("a link that is the whole highlight has no description", () => {
  assert.deepEqual(parseHighlight("Big Fair", "Big Fair"), { title: "Big Fair", description: "" });
});
test("a link in the middle of a sentence stays in the description", () => {
  assert.deepEqual(parseHighlight("In our prior post, we laid out the process.", "prior post"), { title: "prior post", description: "In our prior post, we laid out the process." });
});

test("without a link: a line break ends the title", () => {
  assert.deepEqual(parseHighlight("Pumpkin Patch\nPick one and carve it on the spot"), { title: "Pumpkin Patch", description: "Pick one and carve it on the spot" });
});
test("without a link: punctuation ends the title, a comma does not", () => {
  assert.deepEqual(parseHighlight("Pumpkin Patch. Pick one and carve it."), { title: "Pumpkin Patch", description: "Pick one and carve it." });
  assert.deepEqual(parseHighlight("Is it fun? Yes it is"), { title: "Is it fun?", description: "Yes it is" });
  assert.deepEqual(parseHighlight("Tickets - only 5 left"), { title: "Tickets", description: "only 5 left" });
  assert.deepEqual(parseHighlight("Doors: 7pm sharp"), { title: "Doors", description: "7pm sharp" });
  assert.deepEqual(parseHighlight("Hello, world this is it"), { title: "Hello, world this is it", description: "" });
});
test("a hyphenated word is not a dash", () => {
  assert.deepEqual(parseHighlight("A well-known thing to do"), { title: "A well-known thing to do", description: "" });
});
test("a long text with no break gets a short title and keeps everything as the description", () => {
  const long = "word ".repeat(60).trim();
  const r = parseHighlight(long);
  assert.ok(r.title.length <= 91 && r.title.endsWith("…"));
  assert.equal(r.description, long);
});

test("customChunk: its own id range, a flat text, a normalized link", () => {
  const c = customChunk({ id: 3, text: "Pumpkin Patch\nPick one and carve it.", url: "https://www.x.com/p?utm_source=a", linkText: null });
  assert.equal(c.id, CUSTOM_BASE + 3);
  assert.ok(isCustomId(c.id) && !isCustomId(999_999));
  assert.deepEqual([c.title, c.blurb, c.key, c.section], ["Pumpkin Patch", "Pick one and carve it.", "https://x.com/p", "Highlights"]);
  assert.equal(c.text, "Pumpkin Patch Pick one and carve it.");
  assert.equal(c.rank, null);
});
