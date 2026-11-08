import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { fakes } from "../../../test/setup"; // first: sets the env and the fake network
import { inRequest, makeRequest } from "../../../test/request";
import { checkKey } from "../../../lib/beehiiv";
import { FAKE_KEY } from "../../../lib/fakeBeehiiv";
import { signPreview } from "../../../lib/previewSig";
import { GET as preview } from "./preview/route";

// Buffer fetches slide images with no cookies and no login: the signed address is the only key. It must open exactly the slides it was made for,
// for the account it was made for, and nothing else.

const ORIGIN = "https://pollen.test";
const MODE = "own:pub_00000000-0000-4000-8000-0000000000a1:post_00000000-0000-4000-8000-00000000a101";
const U1 = "00000000-0000-4000-8000-0000000000b1";
const U2 = "00000000-0000-4000-8000-0000000000b2";

async function account(uid: string) {
  const publications = await checkKey(FAKE_KEY);
  fakes.supabase.connections.set(`${uid}:beehiiv`, { secret: FAKE_KEY, last4: "x", meta: { publications }, status: "active", leaseHeld: false });
}
const qs = (o: Record<string, string>) => new URLSearchParams(o);
async function get(params: URLSearchParams, uid: string | null = null) {
  const req = makeRequest(`${ORIGIN}/api/slide/preview?${params}`, { uid });
  const { value } = await inRequest(req, () => preview(req));
  return value;
}

beforeEach(() => fakes.reset());

describe("signed slide addresses", () => {
  test("a valid signature opens the slide with no cookie at all", async () => {
    await account(U1);
    const p = signPreview(qs({ mode: MODE, picks: "6,3" }), U1);
    p.set("n", "0");
    const res = await get(p);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /image\/png/);
  });
  test("every slide of the set opens with the same signature", async () => {
    await account(U1);
    const p = signPreview(qs({ mode: MODE, picks: "6,3" }), U1);
    for (const n of ["0", "1", "2"]) {
      p.set("n", n);
      assert.equal((await get(p)).status, 200, n);
    }
  });
  test("a slide that does not exist is a 400, not a crash", async () => {
    await account(U1);
    const p = signPreview(qs({ mode: MODE, picks: "6,3" }), U1);
    for (const n of ["99", "-1", "x"]) {
      p.set("n", n);
      assert.equal((await get(p)).status, 400, n);
    }
  });
  test("picks that match nothing are a 400", async () => {
    await account(U1);
    const p = signPreview(qs({ mode: MODE, picks: "99999" }), U1);
    assert.equal((await get(p)).status, 400);
  });
  test("a changed address is refused with 403, and nothing is loaded", async () => {
    await account(U1);
    const base = signPreview(qs({ mode: MODE, picks: "6,3" }), U1);
    for (const [k, v] of [["picks", "6,3,1"], ["mode", MODE.replace("a101", "a102")], ["u", U2], ["template", "x"]]) {
      const p = new URLSearchParams(base);
      p.set(k, v);
      assert.equal((await get(p)).status, 403, k);
    }
  });
  test("an expired signature is refused", async () => {
    await account(U1);
    const p = signPreview(qs({ mode: MODE, picks: "6,3" }), U1, Date.now() - 15 * 24 * 3_600_000);
    assert.equal((await get(p)).status, 403);
  });
  test("a bogus or empty signature is refused", async () => {
    for (const sig of ["", "nonsense"]) assert.equal((await get(qs({ mode: MODE, picks: "6,3", u: U1, exp: String(Date.now() + 1e9), sig }))).status, 403, sig);
  });
  test("a signature for one account never reads another account's issue", async () => {
    await account(U1); // U2 has no beehiiv connection
    const p = signPreview(qs({ mode: MODE, picks: "6,3" }), U2);
    const res = await get(p);
    assert.ok(res.status === 401 || res.status === 403, `status ${res.status}`);
    assert.notEqual(res.status, 200);
  });
  test("an own issue with neither a signature nor a session is refused", async () => {
    await account(U1);
    assert.equal((await get(qs({ mode: MODE, picks: "6,3" }))).status, 401);
  });
  test("claiming to be someone with a bare u= (no signature) gets nothing: the user comes from the signature only", async () => {
    await account(U1);
    const p = qs({ mode: MODE, picks: "6,3", u: U1, exp: String(Date.now() + 1e9), n: "0" });
    assert.equal((await get(p)).status, 401);
    assert.equal((await get(qs({ mode: MODE, picks: "6,3", u: U1, n: "0" }))).status, 401);
  });
  test("a signed link may be kept for good (immutable); an own-issue preview opened with a login, and an error, may not", async () => {
    await account(U1);
    const p = signPreview(qs({ mode: MODE, picks: "6,3" }), U1);
    p.set("n", "0");
    assert.match((await get(p)).headers.get("cache-control") ?? "", /max-age=31536000.*immutable|immutable.*max-age=31536000/);
    const own = await get(qs({ mode: MODE, picks: "6,3", n: "0" }), U1);
    assert.equal(own.status, 200);
    assert.doesNotMatch(own.headers.get("cache-control") ?? "", /immutable/);
    p.set("n", "99");
    const bad = await get(p);
    assert.equal(bad.status, 400);
    assert.doesNotMatch(bad.headers.get("cache-control") ?? "", /immutable/);
  });
  test("in production the slide is kept in Netlify's shared (durable) cache for a day, per query", async () => {
    await account(U1);
    const env = process.env as Record<string, string | undefined>;
    const was = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      const p = signPreview(qs({ mode: MODE, picks: "6,3" }), U1);
      p.set("n", "0");
      const res = await get(p);
      assert.equal(res.status, 200);
      assert.match(res.headers.get("netlify-cdn-cache-control") ?? "", /\bdurable\b.*s-maxage=86400|s-maxage=86400.*\bdurable\b/);
      assert.equal(res.headers.get("netlify-vary"), "query");
    } finally {
      if (was === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = was;
    }
  });
  test("a signed link is always the full-size image: a small preview size is ignored", async () => {
    await account(U1);
    const p = signPreview(qs({ mode: MODE, picks: "6,3", fmt: "web", w: "200" }), U1);
    p.set("n", "0");
    const res = await get(p);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /png/);
  });
});
