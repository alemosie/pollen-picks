import assert from "node:assert/strict";
import { test } from "node:test";
import { filtersToQuery, hasFilters, parseFilters } from "./historyFilters";

const from = (q: string) => {
  const sp = new URLSearchParams(q);
  return parseFilters((k) => sp.get(k));
};

test("valid filters are read", () => {
  assert.deepEqual(from("service=linkedin&channel=abc123&status=failed&mode=now"), { service: "linkedin", channelId: "abc123", status: "failed", mode: "now" });
});
test("unknown or malformed values are ignored", () => {
  assert.deepEqual(from("service=a%20b&channel=%3Cscript%3E&status=bogus&mode=later"), {});
  assert.deepEqual(from("status=__proto__"), {});
  assert.deepEqual(from("service=" + "x".repeat(41)), {});
  assert.deepEqual(from(""), {});
});
test("filters survive a round trip through the address", () => {
  const f = { service: "instagram", channelId: "ch:1.2", status: "check", mode: "draft" } as const;
  assert.deepEqual(from(filtersToQuery(f)), f);
  assert.equal(filtersToQuery({}), "");
});
test("hasFilters", () => {
  assert.equal(hasFilters({}), false);
  assert.equal(hasFilters({ mode: "now" }), true);
});
