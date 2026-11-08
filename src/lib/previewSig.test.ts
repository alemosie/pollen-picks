import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import "../test/setup"; // first: sets SESSION_SECRET
import { signPreview, verifyPreview } from "./previewSig";

// Buffer fetches the slide images with no cookies, so the address itself is the key: an HMAC over the whole query. It must open exactly the one
// set of slides it was made for, for the person it was made for, until it expires, and nothing else.

const base = () => new URLSearchParams({ mode: "own:pub_1:post_1", picks: "1,2", fmt: "carousel" });
const DAY = 24 * 3_600_000;
const SECRET = process.env.SESSION_SECRET!;
afterEach(() => {
  process.env.SESSION_SECRET = SECRET;
});

describe("sign and verify", () => {
  test("a signed address verifies and names its user", () => {
    assert.equal(verifyPreview(signPreview(base(), "user-1")), "user-1");
  });
  test("the slide number is not signed: one signature opens every slide of the set", () => {
    const p = signPreview(base(), "user-1");
    for (const n of ["0", "1", "7"]) {
      const q = new URLSearchParams(p);
      q.set("n", n);
      assert.equal(verifyPreview(q), "user-1");
    }
  });
  test("the order of the parameters does not matter", () => {
    const p = signPreview(base(), "user-1");
    const shuffled = new URLSearchParams([...p.entries()].reverse());
    assert.equal(verifyPreview(shuffled), "user-1");
  });
  test("the input is not changed", () => {
    const b = base();
    signPreview(b, "user-1");
    assert.equal(b.has("sig"), false);
  });
});

describe("nothing can be changed", () => {
  for (const [k, v] of [["picks", "1,2,3"], ["mode", "own:pub_1:post_2"], ["fmt", "other"]] as const) {
    test(`changing ${k} invalidates it`, () => {
      const p = signPreview(base(), "user-1");
      p.set(k, v);
      assert.equal(verifyPreview(p), null);
    });
  }
  test("adding a parameter invalidates it", () => {
    const p = signPreview(base(), "user-1");
    p.set("template", "x");
    assert.equal(verifyPreview(p), null);
  });
  test("removing a parameter invalidates it", () => {
    const p = signPreview(base(), "user-1");
    p.delete("picks");
    assert.equal(verifyPreview(p), null);
  });
  test("it cannot be handed to another user", () => {
    const p = signPreview(base(), "user-1");
    p.set("u", "user-2");
    assert.equal(verifyPreview(p), null);
  });
  test("it cannot be given a longer life", () => {
    const p = signPreview(base(), "user-1");
    p.set("exp", String(Number(p.get("exp")) + 365 * DAY));
    assert.equal(verifyPreview(p), null);
  });
  test("values that only look the same once decoded do not collide", () => {
    const a = signPreview(new URLSearchParams({ a: "1&b=2" }), "u");
    const b = signPreview(new URLSearchParams({ a: "1", b: "2" }), "u");
    assert.notEqual(a.get("sig"), b.get("sig"));
  });
});

describe("expiry", () => {
  test("lasts 14 days, so scheduled posts can still fetch their images", () => {
    const t0 = 1_000_000_000_000;
    const p = signPreview(base(), "user-1", t0);
    assert.equal(Number(p.get("exp")) - t0, 14 * DAY);
    assert.equal(verifyPreview(p, t0 + 14 * DAY - 1000), "user-1");
    assert.equal(verifyPreview(p, t0 + 14 * DAY + 1), null);
  });
});

describe("malformed", () => {
  test("missing signature, user or expiry", () => {
    for (const drop of ["sig", "u", "exp"]) {
      const p = signPreview(base(), "user-1");
      p.delete(drop);
      assert.equal(verifyPreview(p), null, drop);
    }
  });
  test("a non-numeric expiry", () => {
    const p = signPreview(base(), "user-1");
    p.set("exp", "soon");
    assert.equal(verifyPreview(p), null);
  });
  test("a signature of the wrong length or garbage does not throw", () => {
    for (const sig of ["x", "", "a".repeat(200), "%%%"]) {
      const p = signPreview(base(), "user-1");
      p.set("sig", sig);
      assert.equal(verifyPreview(p), null);
    }
  });
  test("a plain address with no signature at all", () => {
    assert.equal(verifyPreview(base()), null);
  });
});

describe("the secret", () => {
  test("a signature made under another secret is refused", () => {
    const p = signPreview(base(), "user-1");
    process.env.SESSION_SECRET = "z".repeat(48);
    assert.equal(verifyPreview(p), null);
  });
  test("a missing or short secret throws instead of signing with a weak key", () => {
    process.env.SESSION_SECRET = "short";
    assert.throws(() => signPreview(base(), "user-1"), /SESSION_SECRET/);
    delete process.env.SESSION_SECRET;
    assert.throws(() => signPreview(base(), "user-1"), /SESSION_SECRET/);
  });
});
