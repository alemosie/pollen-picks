import assert from "node:assert/strict";
import { test } from "node:test";
import { demoUrlFrom, isDemo, isPublicationId, linkMode, ownMode, parseLinkMode, parseOwnMode, previewMode, stepUrl } from "./flow";

const PUB = "pub_00000000-0000-4000-8000-000000000001";
const POST = "post_00000000-0000-4000-8000-000000000002";
const UUID = "00000000-0000-4000-8000-000000000003";

test("step URLs: the demo has its own pages", () => {
  assert.equal(isDemo("demo"), true);
  assert.equal(stepUrl("demo", "pick"), "/demo/pick");
  assert.equal(stepUrl("demo", "design", "picks=1,2"), "/demo/design?picks=1,2");
  assert.equal(stepUrl("own", "write"), "/write?mode=own");
  assert.equal(stepUrl(ownMode(PUB, POST), "send", "x=1"), `/send?mode=${encodeURIComponent(`own:${PUB}:${POST}`)}&x=1`);
});

test("previewMode: nothing for the demo, the mode for the rest", () => {
  assert.equal(previewMode("demo"), "");
  assert.equal(previewMode(undefined), "");
  assert.equal(previewMode("own"), "&mode=own");
});

test("old demo links move to /demo and keep their params", () => {
  assert.equal(demoUrlFrom("design", { mode: "demo", picks: "1,2", spec: ["abc", "def"] }), "/demo/design?picks=1%2C2&spec=abc");
});

test("own mode: plain, with ids, and never anything else", () => {
  assert.deepEqual(parseOwnMode("own"), {});
  assert.deepEqual(parseOwnMode(ownMode(PUB, POST)), { publicationId: PUB, postId: POST });
  assert.equal(parseOwnMode("demo"), null);
  assert.equal(parseOwnMode(undefined), null);
  assert.equal(parseOwnMode(`own:${PUB}:../../etc`), null);
  assert.equal(parseOwnMode(`own:${PUB}`), null);
  assert.equal(parseOwnMode(`own:pub_x:post_y`), null);
});

test("publication ids", () => {
  assert.equal(isPublicationId(PUB), true);
  assert.equal(isPublicationId("pub_short"), false);
  assert.equal(isPublicationId(`${PUB}/../x`), false);
  assert.equal(isPublicationId(42), false);
});

test("link mode", () => {
  assert.equal(linkMode(UUID), `link:${UUID}`);
  assert.deepEqual(parseLinkMode(linkMode(UUID)), { id: UUID });
  assert.equal(parseLinkMode("link:nope"), null);
  assert.equal(parseLinkMode(`link:${UUID}'; drop table x`), null);
  assert.equal(parseLinkMode(undefined), null);
});
