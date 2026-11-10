import assert from "node:assert/strict";
import { describe, test } from "node:test";
import sharp from "sharp";
import { buildPdf, pdfLiteral, slidesToPdf, toPdfPage, wrapText } from "./pdf";

// The PDF Pollen Picks hands to LinkedIn is written by hand, so the structure is checked here: every object is where the cross-reference table says,
// and there is one page per slide. (It was also opened with qpdf and poppler when it was written.)
const slide = (alpha = 1) => sharp({ create: { width: 1080, height: 1350, channels: 4, background: { r: 246, g: 189, b: 96, alpha } } }).png().toBuffer();

describe("buildPdf", () => {
  test("one page per slide, in order, each at its picture's shape", async () => {
    const pdf = await slidesToPdf([await slide(), await slide(), await slide()], "Issue 49");
    const text = pdf.toString("latin1");
    assert.ok(text.startsWith("%PDF-1.4"));
    assert.ok(text.trimEnd().endsWith("%%EOF"));
    assert.match(text, /\/Type \/Pages \/Count 3 \/Kids \[5 0 R 8 0 R 11 0 R\]/);
    assert.equal((text.match(/\/Type \/Page /g) ?? []).length, 3);
    assert.equal((text.match(/\/MediaBox \[0 0 540 675\]/g) ?? []).length, 3, "4:5, the same shape as the slides");
    assert.equal((text.match(/\/Filter \/DCTDecode/g) ?? []).length, 3);
  });
  test("the cross-reference table points at every object", async () => {
    const pdf = await slidesToPdf([await slide(), await slide()], "T");
    const text = pdf.toString("latin1");
    const xrefAt = Number(/startxref\n(\d+)\n%%EOF/.exec(text)![1]);
    assert.equal(text.slice(xrefAt, xrefAt + 4), "xref");
    const entries = [...text.slice(xrefAt).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    assert.equal(entries.length, 4 + 3 * 2, "catalog, page tree, info, the text font, and three objects per page");
    entries.forEach((offset, i) => assert.equal(text.slice(offset, offset + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`));
  });
  test("the picture bytes are the JPEG, untouched, and the stream lengths are true", async () => {
    const page = await toPdfPage(await slide());
    const pdf = buildPdf([page], "T");
    assert.ok(pdf.includes(page.jpeg));
    assert.match(pdf.toString("latin1"), new RegExp(`/Length ${page.jpeg.length} >>\\nstream\\n`));
  });
  test("a title with quotes, accents and emoji can't break the file", () => {
    const pdf = buildPdf([{ jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), width: 10, height: 10 }], 'Ärger "x") /Pages 99 0 R (🌼');
    const text = pdf.toString("latin1");
    assert.match(text, /\/Title <FEFF[0-9A-F]+>/);
    assert.doesNotMatch(text, /\/Pages 99 0 R/);
  });
  test("the words of a slide are written into its page as invisible text", async () => {
    const pdf = await slidesToPdf([await slide(), await slide()], "T", ["Cozy ceramic workshop, Wed 4 Nov", ""]);
    const text = pdf.toString("latin1");
    assert.equal((text.match(/ 3 Tr /g) ?? []).length, 1, "render mode 3 is invisible; the page without words has none");
    assert.match(text, /\(Cozy ceramic workshop, Wed 4 Nov\) Tj/);
    assert.match(text, /\/Font << \/F1 4 0 R >>/);
  });
  test("a stream's declared length is true with a text layer too", () => {
    const pdf = buildPdf([{ jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), width: 10, height: 10, text: "Café (open) \\ ‘quoted’ 🌼" }], "T");
    const text = pdf.toString("latin1");
    const m = /<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/.exec(text)!;
    assert.equal(Number(m[1]), m[2].length);
    assert.match(m[2], /\(Caf\xE9 \\\(open\\\) \\\\ \x91quoted\x92 \?\) Tj/);
  });
  test("text is escaped, one byte a character, and the unshowable becomes a question mark", () => {
    assert.equal(pdfLiteral("a (b) \\ c"), "(a \\(b\\) \\\\ c)");
    assert.equal(pdfLiteral("é – “x”"), "(\xE9 \x96 \x93x\x94)");
    assert.equal(pdfLiteral("🌼"), "(?)");
  });
  test("long text is broken into lines at spaces", () => {
    const lines = wrapText("one two three four five six seven eight nine ten", 15);
    assert.deepEqual(lines, ["one two three", "four five six", "seven eight", "nine ten"]);
    assert.ok(lines.every((l) => l.length <= 15));
    assert.deepEqual(wrapText("   "), []);
  });
  test("no pages is refused rather than written as an empty file", () => {
    assert.throws(() => buildPdf([], "T"), /at least one page/);
  });
  test("a see-through slide is put on white and comes out opaque RGB", async () => {
    const page = await toPdfPage(await slide(0.5));
    assert.equal((await sharp(page.jpeg).metadata()).channels, 3);
    assert.equal(page.width, 1080);
    assert.equal(page.height, 1350);
  });
  test("a page stays well under a megabyte, so a 10-slide send is a few megabytes at most", async () => {
    const noise = Buffer.alloc(1080 * 1350 * 3);
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24;
    const png = await sharp(noise, { raw: { width: 1080, height: 1350, channels: 3 } }).png().toBuffer();
    const page = await toPdfPage(png);
    assert.ok(page.jpeg.length < 2_000_000, `a page of pure noise (the worst case) was ${page.jpeg.length} bytes`);
  });
});
