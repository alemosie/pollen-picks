import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import sharp from "sharp";
import { fakes } from "../test/setup"; // first: sets the env and the fake network
import { makePdf, type Claimed } from "./sendQueue";
import { slidePublicUrl, storeSlide } from "./slideStore";

// The PDF for LinkedIn, made from slides that really are in storage (the fake bucket): fetched back by their public addresses, turned into one PDF,
// stored, and remembered on the send's rows.
const claimed = (over: Partial<Claimed> = {}): Claimed => ({
  id: 1, user_id: "u1", batch_id: "b1", channel_id: "c1", service: "linkedin", mode: "draft", source: "link:abc", picks: [1], template: "", caption: "Hi", attempts: 1, as_pdf: true, issue_title: "Issue 49", ...over,
});
const png = (r: number) => sharp({ create: { width: 1080, height: 1350, channels: 3, background: { r, g: 120, b: 60 } } }).png().toBuffer();

beforeEach(() => fakes.reset());

describe("makePdf", () => {
  test("the stored slides become one stored PDF, one page each, with the first slide as the cover", async () => {
    const paths = await Promise.all([10, 120, 230].map(async (r) => storeSlide("u1", { bytes: await png(r), type: "image/png" })));
    const images = paths.map(slidePublicUrl);
    const doc = await makePdf(claimed(), { images });
    assert.ok(doc);
    assert.equal(doc.title, "Issue 49");
    assert.equal(doc.thumbnailUrl, images[0]);
    assert.match(doc.url, /\/slides\/u\/u1\/[0-9a-f]{40}\.pdf$/);
    const stored = fakes.supabase.files.get(doc.url.split("/slides/")[1]);
    assert.ok(stored, "the PDF is in the bucket");
    const text = Buffer.from(stored).toString("latin1");
    assert.ok(text.startsWith("%PDF-1.4"));
    assert.match(text, /\/Count 3 /);
  });
  test("the alt text of each slide is written into its page, so the PDF can be read by a screen reader", async () => {
    const paths = await Promise.all([10, 200].map(async (r) => storeSlide("u1", { bytes: await png(r), type: "image/png" })));
    const doc = await makePdf(claimed(), { images: paths.map(slidePublicUrl), alts: ["Cozy ceramic workshop, Wed 4 Nov", "See you next week"] });
    const text = Buffer.from(fakes.supabase.files.get(doc!.url.split("/slides/")[1])!).toString("latin1");
    assert.match(text, /\(Cozy ceramic workshop, Wed 4 Nov\) Tj/);
    assert.match(text, /\(See you next week\) Tj/);
  });
  test("the small JPEG of the first slide is the cover when there is one (it is the lighter picture)", async () => {
    const path = await storeSlide("u1", { bytes: await png(10), type: "image/png" });
    const small = await storeSlide("u1", { bytes: await sharp(await png(10)).jpeg().toBuffer(), type: "image/jpeg" });
    const doc = await makePdf(claimed(), { images: [slidePublicUrl(path)], smallImages: [slidePublicUrl(small)] });
    assert.equal(doc?.thumbnailUrl, slidePublicUrl(small));
  });
  test("its path is remembered on every row of the send, so a retry reuses it", async () => {
    fakes.supabase.tables.set("post_history", [
      { id: 1, user_id: "u1", batch_id: "b1" },
      { id: 2, user_id: "u1", batch_id: "b1" },
      { id: 3, user_id: "u1", batch_id: "other" },
    ]);
    const path = await storeSlide("u1", { bytes: await png(10), type: "image/png" });
    const doc = await makePdf(claimed(), { images: [slidePublicUrl(path)] });
    const rows = fakes.supabase.rows("post_history");
    assert.match(String(rows[0].slide_pdf_path), /\.pdf$/);
    assert.equal(rows[1].slide_pdf_path, rows[0].slide_pdf_path);
    assert.equal(rows[2].slide_pdf_path, undefined);
    assert.equal(doc?.url, slidePublicUrl(String(rows[0].slide_pdf_path)));
  });
  test("a PDF already stored for the send is used as is: no slide is fetched and nothing is drawn again", async () => {
    const before = fakes.supabase.files.size;
    const doc = await makePdf(claimed({ slide_pdf_path: "u/u1/already.pdf" }), { images: ["http://db.test/storage/v1/object/public/slides/u/u1/missing.png"] });
    assert.equal(doc?.url, slidePublicUrl("u/u1/already.pdf"));
    assert.equal(fakes.supabase.files.size, before);
  });
  test("a slide that can't be fetched: no PDF (null), so LinkedIn gets the images; nothing is stored", async () => {
    const before = fakes.supabase.files.size;
    const doc = await makePdf(claimed(), { images: [slidePublicUrl("u/u1/missing.png")] });
    assert.equal(doc, null);
    assert.equal(fakes.supabase.files.size, before);
  });
  test("the title is the issue's, cut to 100 characters, and falls back to the newsletter's name", async () => {
    const path = await storeSlide("u1", { bytes: await png(10), type: "image/png" });
    const images = [slidePublicUrl(path)];
    assert.equal((await makePdf(claimed({ issue_title: "x".repeat(300) }), { images }))?.title.length, 100);
    assert.equal((await makePdf(claimed({ issue_title: "", newsletter: "Just a Phase" }), { images }))?.title, "Just a Phase");
  });
});
