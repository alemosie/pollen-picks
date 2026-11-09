import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { fakes } from "../../test/setup"; // first: sets the env and the fake network
import { inRequest, makeRequest } from "../../test/request";
import { POST } from "./feedback/route";

// The feedback form. "OK to share?" is one answer: yes lets Alex quote the feedback and keeps the links to the source and the slides; no keeps neither.
const answers = { host: "beehiiv", likelihood: 4 };
const share = { slideUrl: "https://pollen.test/demo/design?picks=1,2", sourceUrl: "https://example.com/p/issue" };
async function send(body: Record<string, unknown>) {
  const req = makeRequest("https://pollen.test/api/feedback", { body: { ...answers, ...body }, headers: { host: "pollen.test" } });
  const { value } = await inRequest(req, () => POST(req));
  return value.status;
}
const rows = () => [...(fakes.supabase.tables.get("feedback") ?? [])] as Record<string, unknown>[];

describe("feedback: OK to share?", () => {
  beforeEach(() => fakes.supabase.tables.delete("feedback"));

  test("yes: quote_ok and both links are saved", async () => {
    assert.equal(await send({ quoteOk: true, share }), 200);
    assert.equal(rows()[0].quote_ok, true);
    assert.equal(rows()[0].slide_url, share.slideUrl);
    assert.equal(rows()[0].source_url, share.sourceUrl);
  });
  test("no: nothing about the creation is saved, even if the browser sent it", async () => {
    assert.equal(await send({ quoteOk: false, share }), 200);
    assert.equal(rows()[0].quote_ok, false);
    assert.ok(rows()[0].slide_url == null && rows()[0].source_url == null);
  });
  test("yes with a link to another site: the answers are saved, the link is not", async () => {
    assert.equal(await send({ quoteOk: true, share: { slideUrl: "https://evil.test/demo/design?picks=1" } }), 200);
    assert.equal(rows().length, 1);
    assert.ok(rows()[0].slide_url == null);
  });
  test("yes with nothing to share (no run): just the answers", async () => {
    assert.equal(await send({ quoteOk: true }), 200);
    assert.equal(rows()[0].quote_ok, true);
    assert.ok(rows()[0].slide_url == null);
  });
});

describe("feedback: the stored slides of a yes", () => {
  const stored = ["u/u1/a.png", "u/u1/b.png"];
  const posts = () => fakes.supabase.tables.set("post_history", [{ id: 1, user_id: "u1", mode: "draft", created_at: "2026-11-09T10:00:00Z", slide_paths: stored }]);
  async function sendAs(uid: string | null, body: Record<string, unknown>) {
    const req = makeRequest("https://pollen.test/api/feedback", { uid, body: { ...answers, ...body }, headers: { host: "pollen.test" } });
    const { value } = await inRequest(req, () => POST(req));
    return value.status;
  }
  beforeEach(() => {
    fakes.supabase.tables.delete("feedback");
    posts();
  });

  test("logged in, yes, with something to share: the latest send's slides are kept, read from their own history", async () => {
    assert.equal(await sendAs("u1", { quoteOk: true, share }), 200);
    assert.deepEqual(rows()[0].slide_images, stored.map((p) => `http://db.test/storage/v1/object/public/slides/${p}`));
  });
  test("no: no slides, even when the account has some", async () => {
    assert.equal(await sendAs("u1", { quoteOk: false, share }), 200);
    assert.ok(rows()[0].slide_images == null);
  });
  test("a slide list sent by the browser is ignored", async () => {
    assert.equal(await sendAs("u1", { quoteOk: true, share, slide_images: ["https://evil.test/x.png"], slideImages: ["https://evil.test/x.png"] }), 200);
    assert.ok(!JSON.stringify(rows()[0].slide_images).includes("evil.test"));
  });
  test("not logged in: no slides, someone else's are never attached", async () => {
    assert.equal(await sendAs(null, { quoteOk: true, share }), 200);
    assert.ok(rows()[0].slide_images == null);
  });
  test("yes with nothing to share: no slides either", async () => {
    assert.equal(await sendAs("u1", { quoteOk: true }), 200);
    assert.ok(rows()[0].slide_images == null);
  });
});
