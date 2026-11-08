import assert from "node:assert/strict";
import { test } from "node:test";
import { pickerKey } from "./picking";

const M = "own:pub_1:post_1";
const U = "https://example.org/p/x";

test("a fresh run never shares a Picker with the run it replaces", () => {
  assert.notEqual(pickerKey(M, U, "abc123"), pickerKey(M, U, ""));
});
test("two fresh starts of the SAME issue never share a Picker (start over, discard, same issue again)", () => {
  assert.notEqual(pickerKey(M, U, "abc123"), pickerKey(M, U, "def456"));
});
test("the same issue keeps the same Picker between visits that are not fresh", () => {
  assert.equal(pickerKey(M, U, ""), pickerKey(M, U, ""));
});
test("another issue gets its own Picker", () => {
  assert.notEqual(pickerKey(M, U, ""), pickerKey(M, U + "2", ""));
  assert.notEqual(pickerKey(M, U, "abc123"), pickerKey(M, U + "2", "abc123"));
});
