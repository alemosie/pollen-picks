import assert from "node:assert/strict";
import { test } from "node:test";
import { parseChunks } from "./chunks";

const ISSUE = `
<h2>What's happening</h2>
<p>West</p>
<ul>
  <li><p><a href="https://ex.com/a?utm_source=x">Story time 📚</a><br><em>Sat 24 Oct @ 9:30-11:00 — De Pijp</em></p><p>Songs and stories for babies.</p></li>
  <li><p><strong>Local trick or treating</strong></p><p>Walk the neighborhood in costume.</p></li>
</ul>
<p>Short</p>
<p>This is a paragraph with a <a href="https://ex.com/p">link inside it</a> that is long enough.</p>
<h2>Footer</h2>
<p>Thanks for reading everyone, see you next week.</p>`;

test("a bullet: link, date line, place and blurb are told apart", () => {
  const c = parseChunks(ISSUE)[0];
  assert.equal(c.kind, "bullet");
  assert.equal(c.section, "What's happening");
  assert.equal(c.group, "West");
  assert.equal(c.title, "Story time"); // the trailing emoji is trimmed
  assert.equal(c.url, "https://ex.com/a?utm_source=x");
  assert.equal(c.key, "https://ex.com/a");
  assert.equal(c.when, "Sat 24 Oct @ 9:30-11:00");
  assert.equal(c.place, "De Pijp");
  assert.match(c.blurb, /^Songs and stories for babies\.?$/);
  assert.ok(!c.blurb.includes("Oct"), "the date line is not repeated in the blurb");
});

test("a bullet without a link takes its title from its bold text", () => {
  const c = parseChunks(ISSUE)[1];
  assert.equal(c.title, "Local trick or treating");
  assert.equal(c.url, null);
  assert.equal(c.key, null);
});

test("a paragraph is a chunk too; text under 15 characters is not", () => {
  const all = parseChunks(ISSUE);
  assert.equal(all.length, 4);
  assert.ok(!all.some((c) => c.text === "Short"));
  const p = all[2];
  assert.equal(p.kind, "paragraph");
  assert.equal(p.title, "link inside it");
  assert.equal(p.key, "https://ex.com/p");
});

test("a heading starts a new section and clears the group", () => {
  const last = parseChunks(ISSUE)[3];
  assert.equal(last.section, "Footer");
  assert.equal(last.group, undefined);
});

test("ids are the position in the issue", () => {
  assert.deepEqual(parseChunks(ISSUE).map((c) => c.id), [0, 1, 2, 3]);
});

test("a bold label above a list is a topic as well as a group; a plain one is only a group", () => {
  const bold = parseChunks(`<h2>Around town</h2><p><strong>South</strong></p><ul><li><p><a href="https://ex.com/s">South event</a></p><p>Something nice to do.</p></li></ul>`)[0];
  assert.deepEqual([bold.group, bold.topic], ["South", "South"]);
  const plain = parseChunks(`<h2>Around town</h2><p>Good for babies</p><ul><li><p><a href="https://ex.com/s">Baby event</a></p><p>Something nice to do.</p></li></ul>`)[0];
  assert.deepEqual([plain.group, plain.topic], ["Good for babies", undefined]);
});

test("a bold line with a list further down is a topic for the items below it", () => {
  const chunks = parseChunks(
    `<h2>Trip</h2><p><strong>Sint Maarten</strong></p><p>A lead-in paragraph that is long enough to count.</p><ul><li><p><a href="https://ex.com/b">Beach day</a></p><p>Sand and sun.</p></li></ul>`,
  );
  assert.equal(chunks.find((c) => c.title === "Beach day")?.topic, "Sint Maarten");
});

test("the group applies to the one list below it only", () => {
  const chunks = parseChunks(`<h2>A</h2><p>West</p><ul><li><p><a href="https://ex.com/1">One</a></p><p>First item here.</p></li></ul><ul><li><p><a href="https://ex.com/2">Two</a></p><p>Second item here.</p></li></ul>`);
  assert.deepEqual(chunks.map((c) => c.group), ["West", undefined]);
});

test("long titles are cut to 90 characters", () => {
  const long = "x".repeat(150);
  const c = parseChunks(`<h2>A</h2><p><a href="https://ex.com/l">${long}</a> and then some more text after the link.</p>`)[0];
  assert.ok(c.title.length <= 90);
});

test("text from separate inline tags does not leave a gap before punctuation", () => {
  const c = parseChunks(`<h2>A</h2><p><strong>25% off</strong>. Come and get it while stocks last today.</p>`)[0];
  assert.ok(c.text.startsWith("25% off."), c.text);
});

test("no chunks from an empty or heading-only issue", () => {
  assert.deepEqual(parseChunks(""), []);
  assert.deepEqual(parseChunks("<h1>Only a heading</h1>"), []);
});

test("separators left at the start of a description are stripped; opening quotes stay", () => {
  const html = (t: string) => `<h2>What's on</h2><ul><li><p><a href="https://ex.com/a">Title here</a> ${t}</p></li></ul>`;
  assert.equal(parseChunks(html("— A walk through wakers."))[0].blurb, "A walk through wakers.");
  assert.equal(parseChunks(html(": · Songs and stories."))[0].blurb, "Songs and stories.");
  assert.equal(parseChunks(html("“Quoted” start."))[0].blurb, "“Quoted” start.");
});

const SPREAD = `<h2>Events</h2>
<h3>📅 Friday</h3>
<p>🎪 <a href="https://ex.com/circus">Weber Bros presents The Circus</a></p>
<p>Final weekend in Upper Hutt for the Human Cannonball.</p>
<p>📍 Riverbank Park, Upper Hutt | 🕖 Fri 7:30pm, Sat 2pm &amp; 7:30pm | 💲 From $25</p>
<p>🎬 <a href="https://ex.com/cinema">Outdoor Cinema: Moana</a></p>
<p>Bring a blanket and a picnic.</p>
<p>📍 Waitangi Park | 🕗 8:30pm | 💲 Free</p>
<h2>Food</h2>
<p><strong>RBar</strong></p>
<p>Cuba Street's pirate-themed rum bar has reopened. Follow <a href="https://ex.com/rbar">@rbar</a> for specials.</p>`;

test("an entry spread over paragraphs (emoji + link, description, details line) is one chunk", () => {
  const c = parseChunks(SPREAD);
  assert.equal(c.length, 3);
  assert.equal(c[0].title, "Weber Bros presents The Circus");
  assert.equal(c[0].url, "https://ex.com/circus");
  assert.equal(c[0].place, "Riverbank Park, Upper Hutt");
  assert.equal(c[0].when, "Fri 7:30pm, Sat 2pm & 7:30pm");
  assert.equal(c[0].blurb, "Final weekend in Upper Hutt for the Human Cannonball.");
});

test("a day subheading gives a time-only entry its day", () => {
  const c = parseChunks(SPREAD);
  assert.equal(c[1].when, "Friday 8:30pm");
  assert.equal(c[1].place, "Waitangi Park");
});

test("a bold venue name leads an entry; its link is the one in the description", () => {
  const c = parseChunks(SPREAD)[2];
  assert.equal(c.title, "RBar");
  assert.equal(c.url, "https://ex.com/rbar");
  assert.match(c.blurb, /^Cuba Street's pirate-themed rum bar/);
});

test("a paragraph with a link inside a sentence is not merged with the next one", () => {
  const c = parseChunks(`<h2>News</h2><p>Read <a href="https://ex.com/a">this long story about trams</a> and weep for the commute.</p><p>And a second paragraph that stands alone here.</p>`);
  assert.equal(c.length, 2);
});

test("a description starts with an upper case letter", () => {
  const c = parseChunks(`<h2>Events</h2><ul><li><a href="https://ex.com/a">Gatti's Music Hall</a> — the museum's deep ice wells become a music hall.</li></ul>`);
  assert.equal(c[0].blurb, "The museum's deep ice wells become a music hall.");
});
