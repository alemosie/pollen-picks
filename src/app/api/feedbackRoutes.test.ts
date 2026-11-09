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
