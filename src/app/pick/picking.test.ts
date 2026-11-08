import assert from "node:assert/strict";
import { test } from "node:test";
import { pickerKey } from "./picking";

const M = "own:pub_1:post_1";
const U = "https://example.org/p/x";

test("a fresh run never shares a Picker with the run it replaces", () => {
  assert.notEqual(pickerKey(M, U, true), pickerKey(M, U, false));
});
test("the same issue keeps the same Picker between visits that are not fresh", () => {
  assert.equal(pickerKey(M, U, false), pickerKey(M, U, false));
});
test("another issue gets its own Picker", () => {
  assert.notEqual(pickerKey(M, U, false), pickerKey(M, U + "2", false));
});
