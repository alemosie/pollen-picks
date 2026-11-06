import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { clearProgress, clearResume, clearSendBatches, loadFormat, loadPicked, loadProgress, loadSendBatches, loadTemplate, savePicked, saveFormat, saveProgress, saveSendBatches, saveTemplate, templateSnapshot } from "./progress";

const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
});
beforeEach(() => store.clear());

const fmt = { sig: "s", order: "clicks", edited: {}, tab: "instagram" };
const tpl = (scope: string) => ({ custom: true, spec: { slides: [[1, 2]] }, scope });

test("a run is one record", () => {
  savePicked([1, 2], "own|a");
  saveFormat(fmt);
  saveTemplate(tpl("own|a"));
  saveSendBatches("s", { batchIds: ["b1"], intent: "draft" });
  assert.deepEqual([...store.keys()], ["pollen-picks:run"]);
});

test("everything saved for the same issue comes back", () => {
  savePicked([1, 2], "own|a");
  saveFormat(fmt);
  saveTemplate(tpl("own|a"));
  assert.deepEqual(loadPicked("own|a"), [1, 2]);
  assert.deepEqual(loadFormat(), fmt);
  assert.equal(loadTemplate()?.scope, "own|a");
  assert.ok(templateSnapshot());
});

test("another issue gets none of it: picks, layout and caption go together", () => {
  savePicked([1, 2], "own|a");
  saveFormat(fmt);
  saveTemplate(tpl("own|a"));
  saveSendBatches("s", { batchIds: ["b1"], intent: "now" });
  assert.equal(loadPicked("own|b"), null, "not handed out for another scope");
  savePicked([], "own|b"); // Pick saves what it restored (nothing) for the new issue
  assert.deepEqual(loadPicked("own|b"), []);
  assert.equal(loadFormat(), null);
  assert.equal(loadTemplate(), null);
  assert.equal(templateSnapshot(), null);
  assert.equal(loadSendBatches("s"), null);
});

test("where the user is survives a change of issue; the old run does not", () => {
  saveProgress("/pick?mode=own", 2);
  savePicked([3], "own|a");
  savePicked([], "own|b");
  assert.equal(loadProgress()?.step, 2);
  assert.equal(loadPicked("own|a"), null);
});

test("the share link reads the last picks without a scope", () => {
  savePicked([4, 5], "own|a");
  assert.deepEqual(loadPicked(), [4, 5]);
});

test("a layout saved for another issue replaces the run", () => {
  savePicked([1], "own|a");
  saveTemplate(tpl("own|b"));
  assert.equal(loadPicked("own|a"), null);
  assert.equal(loadTemplate()?.scope, "own|b");
});

test("clearResume keeps the run; clearProgress drops it; Start over also drops the old separate keys", () => {
  saveProgress("/send", 5);
  savePicked([1], "own|a");
  clearResume();
  assert.equal(loadProgress(), null);
  assert.deepEqual(loadPicked("own|a"), [1]);
  store.set("pollen-picks:picked", "{}");
  clearProgress();
  assert.equal(store.size, 0);
});

test("the old separate keys are removed on the first save", () => {
  for (const k of ["progress", "picked", "format", "template", "send"]) store.set(`pollen-picks:${k}`, "{}");
  savePicked([1], "own|a");
  assert.deepEqual([...store.keys()], ["pollen-picks:run"]);
});

test("send batches expire after two hours and clear on request", () => {
  saveSendBatches("s", { batchIds: ["b1", "b2"], intent: "now" });
  assert.deepEqual(loadSendBatches("s"), { batchIds: ["b1", "b2"], intent: "now" });
  assert.equal(loadSendBatches("other"), null);
  const run = JSON.parse(store.get("pollen-picks:run")!);
  run.send.savedAt -= 3 * 60 * 60 * 1000;
  store.set("pollen-picks:run", JSON.stringify(run));
  assert.equal(loadSendBatches("s"), null);
  saveSendBatches("s", { batchIds: ["b"], intent: "draft" });
  clearSendBatches();
  assert.equal(loadSendBatches("s"), null);
});

test("damaged storage is ignored", () => {
  store.set("pollen-picks:run", "not json");
  assert.equal(loadPicked("x"), null);
  store.set("pollen-picks:run", "[1,2]");
  assert.equal(loadFormat(), null);
  savePicked([1], "x");
  assert.deepEqual(loadPicked("x"), [1]);
});
