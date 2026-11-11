import assert from "node:assert/strict";
import { test } from "node:test";
import { SIGNED_IN_HINT_SCRIPT } from "./signedInHint";
import { HINT_COOKIE } from "./session";

// Runs the page script against a stand-in document.
function run(cookie: string | null) {
  const attrs: Record<string, string> = {};
  const doc = { get cookie() { if (cookie === null) throw new Error("cookies blocked"); return cookie; }, documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
  new Function("document", SIGNED_IN_HINT_SCRIPT)(doc);
  return attrs;
}

test("a signed-in marker cookie marks the page as signed in", () => {
  assert.deepEqual(run(`${HINT_COOKIE}=1`), { "data-in": "" });
  assert.deepEqual(run(`theme=dark; ${HINT_COOKIE}=1; other=2`), { "data-in": "" });
});

test("no marker, a different value, or a similarly named cookie leaves the page signed out", () => {
  assert.deepEqual(run(""), {});
  assert.deepEqual(run(`${HINT_COOKIE}=0`), {});
  assert.deepEqual(run(`x${HINT_COOKIE}=1`), {});
});

test("a browser that blocks cookies fails quietly", () => {
  assert.deepEqual(run(null), {});
});
