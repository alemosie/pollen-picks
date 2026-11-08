import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import * as P from "./progress";
import { applyOpened, forgetRun, loadSync, openedUrl, patchSync } from "./runSync";

// The browser's copy of a run (localStorage) and what this browser last learned from the server. The promises:
//   - one record, so picks, layout and caption can never come from different issues;
//   - saving for another scope throws the old run's picks/layout/caption away;
//   - starting a fresh run leaves nothing behind;
//   - blocked or broken storage never throws.

class MemStorage {
  data = new Map<string, string>();
  getItem = (k: string) => (this.data.has(k) ? this.data.get(k)! : null);
  setItem = (k: string, v: string) => void this.data.set(k, String(v));
  removeItem = (k: string) => void this.data.delete(k);
  clear = () => this.data.clear();
}
let store: MemStorage;
let cookie = "";
let events: string[] = [];
const g = globalThis as unknown as Record<string, unknown>;

beforeEach(() => {
  store = new MemStorage();
  cookie = "";
  events = [];
  g.localStorage = store;
  g.document = {
    get cookie() {
      return cookie;
    },
    set cookie(v: string) {
      cookie = v;
    },
  };
  g.window = { dispatchEvent: (e: { type: string }) => void events.push(e.type) };
  g.Event = class {
    constructor(public type: string) {}
  };
});

const A = "own:pub_1:post_1|https://x.test/a";
const B = "own:pub_1:post_2|https://x.test/b";
const fmt = (sig: string, edited: Record<string, string> = {}) => ({ sig, order: "clicks", edited, tab: "link" });
const tpl = (scope: string, t = "custom") => ({ custom: true, spec: { c: { t } } as never, scope });
const raw = () => store.getItem("pollen-picks:run");

describe("one record per run", () => {
  test("nothing saved: everything loads as empty", () => {
    assert.equal(P.loadPicked(A), null);
    assert.equal(P.loadFormat(), null);
    assert.equal(P.loadTemplate(), null);
    assert.equal(P.loadProgress(), null);
    assert.equal(P.templateSnapshot(), null);
  });
  test("picks, layout, caption and place all live in the one key", () => {
    P.savePicked([1, 2], A);
    P.saveTemplate(tpl(A));
    P.saveFormat(fmt("s", { link: "c" }));
    P.saveProgress("/write", 4);
    assert.deepEqual([...store.data.keys()], ["pollen-picks:run"]);
    const r = JSON.parse(raw()!);
    assert.deepEqual(r.picked, [1, 2]);
    assert.equal(r.scope, A);
    assert.equal(r.format.edited.link, "c");
    assert.equal(r.progress.step, 4);
  });
  test("picks saved for one scope are never handed out for another", () => {
    P.savePicked([1, 2], A);
    assert.deepEqual(P.loadPicked(A), [1, 2]);
    assert.equal(P.loadPicked(B), null);
  });
  test("called without a scope (the share link) it returns whatever was saved last", () => {
    P.savePicked([7], A);
    assert.deepEqual(P.loadPicked(), [7]);
  });
});

describe("a different scope starts a new run", () => {
  test("saving picks for another issue throws the old picks, layout, caption and send away; only 'where you left off' survives", () => {
    P.savePicked([1, 2], A);
    P.saveTemplate(tpl(A, "OLD COVER"));
    P.saveFormat(fmt("s", { link: "OLD CAPTION" }));
    P.saveSendBatches("sig", { batchIds: ["b1"], intent: "now" });
    P.saveProgress("/design", 3);
    P.savePicked([9], B);
    const r = JSON.parse(raw()!);
    assert.deepEqual(r.picked, [9]);
    assert.equal(r.scope, B);
    assert.equal(r.template, undefined);
    assert.equal(r.format, undefined);
    assert.equal(r.send, undefined);
    assert.equal(r.progress.step, 3);
    assert.ok(!raw()!.includes("OLD"));
  });
  test("saving a layout for another issue does the same", () => {
    P.savePicked([1], A);
    P.saveFormat(fmt("s", { link: "OLD CAPTION" }));
    P.saveTemplate(tpl(B));
    assert.equal(P.loadFormat(), null);
    assert.equal(P.loadPicked(A), null);
  });
  test("the same scope keeps everything", () => {
    P.savePicked([1], A);
    P.saveFormat(fmt("s", { link: "kept" }));
    P.savePicked([1, 2], A);
    assert.equal(P.loadFormat()?.edited.link, "kept");
  });
  test("a record that is not an object is treated as empty and overwritten", () => {
    store.setItem("pollen-picks:run", "[1,2,3]");
    assert.equal(P.loadPicked(A), null);
    P.savePicked([1], A);
    assert.deepEqual(P.loadPicked(A), [1]);
    store.setItem("pollen-picks:run", "not json{");
    assert.equal(P.loadPicked(A), null);
  });
});

describe("clearing", () => {
  test("clearProgress forgets everything and the old per-piece keys too", () => {
    for (const k of ["progress", "picked", "format", "template", "send"]) store.setItem(`pollen-picks:${k}`, "x");
    P.savePicked([1], A); // writing the record also drops the legacy keys
    assert.deepEqual([...store.data.keys()], ["pollen-picks:run"]);
    P.clearProgress();
    assert.equal(store.data.size, 0);
  });
  test("clearProgress leaves the channel habit alone (it is the account's, not the run's)", () => {
    P.saveChannelChoice({ selected: ["a"], known: ["a"] });
    P.savePicked([1], A);
    P.clearProgress();
    assert.deepEqual(P.loadChannelChoice(), { selected: ["a"], known: ["a"] });
  });
  test("clearResume drops 'where you left off' and keeps the work", () => {
    P.savePicked([1], A);
    P.saveProgress("/send", 5);
    P.clearResume();
    assert.equal(P.loadProgress(), null);
    assert.deepEqual(P.loadPicked(A), [1]);
  });
  test("clearSendBatches drops only the send", () => {
    P.savePicked([1], A);
    P.saveSendBatches("sig", { batchIds: ["b"], intent: "draft" });
    P.clearSendBatches();
    assert.equal(P.loadSendBatches("sig"), null);
    assert.deepEqual(P.loadPicked(A), [1]);
  });
});

describe("a fresh start", () => {
  test("startFreshRun clears the run AND sets a cookie with a new value every time", () => {
    P.savePicked([1, 2], A);
    P.saveFormat(fmt("s", { link: "OLD CAPTION" }));
    P.startFreshRun();
    assert.equal(raw(), null);
    const first = cookie;
    assert.match(first, new RegExp(`^${P.FRESH_COOKIE}=[a-z0-9]+;`, "i"));
    P.startFreshRun();
    assert.notEqual(cookie, first, "two fresh starts of the same issue must not share an id");
  });
  test("the cookie lasts two minutes and the Pick page can remove it", () => {
    P.startFreshRun();
    assert.match(cookie, /max-age=120/);
    P.endFreshRun();
    assert.match(cookie, /max-age=0/);
  });
  test("readFreshId accepts letters and digits only", () => {
    assert.equal(P.readFreshId("abc123"), "abc123");
    assert.equal(P.readFreshId("1"), "1");
    assert.equal(P.readFreshId(undefined), "");
    assert.equal(P.readFreshId(""), "");
    assert.equal(P.readFreshId("a|b"), "");
    assert.equal(P.readFreshId("x".repeat(41)), "");
    assert.equal(P.readFreshId("<script>"), "");
  });
});

describe("saved captions and the 'Saved' flash", () => {
  test("a changed caption flashes 'Saved'; rewriting the same one does not", () => {
    P.saveFormat(fmt("s", { link: "a" }));
    assert.equal(events.length, 1);
    P.saveFormat(fmt("s", { link: "a" }));
    assert.equal(events.length, 1);
    P.saveFormat(fmt("s", { link: "b" }));
    assert.equal(events.length, 2);
  });
  test("saving a layout flashes", () => {
    P.saveTemplate(tpl(A));
    assert.equal(events.length, 1);
  });
});

describe("the send is remembered for two hours, for the same picks only", () => {
  test("same signature: found; another signature: not", () => {
    P.saveSendBatches("sig1", { batchIds: ["b1", "b2"], intent: "now" });
    assert.deepEqual(P.loadSendBatches("sig1"), { batchIds: ["b1", "b2"], intent: "now" });
    assert.equal(P.loadSendBatches("sig2"), null);
  });
  test("after two hours it is forgotten", () => {
    P.saveSendBatches("sig1", { batchIds: ["b1"], intent: "draft" });
    const r = JSON.parse(raw()!);
    r.send.savedAt = Date.now() - 2 * 60 * 60 * 1000 - 1000;
    store.setItem("pollen-picks:run", JSON.stringify(r));
    assert.equal(P.loadSendBatches("sig1"), null);
  });
  test("an unknown intent falls back to draft, and non-string ids are dropped", () => {
    P.saveSendBatches("s", { batchIds: ["ok"], intent: "draft" });
    const r = JSON.parse(raw()!);
    r.send.intent = "weird";
    r.send.batchIds = ["ok", 5, null];
    store.setItem("pollen-picks:run", JSON.stringify(r));
    assert.deepEqual(P.loadSendBatches("s"), { batchIds: ["ok"], intent: "draft" });
  });
});

describe("storage that is blocked or full never throws", () => {
  test("every call survives a storage that throws", () => {
    const boom = () => {
      throw new Error("blocked");
    };
    g.localStorage = { getItem: boom, setItem: boom, removeItem: boom, clear: boom };
    assert.doesNotThrow(() => {
      P.savePicked([1], A);
      P.saveFormat(fmt("s"));
      P.saveTemplate(tpl(A));
      P.saveProgress("/x", 2);
      P.saveSendBatches("s", { batchIds: [], intent: "draft" });
      P.clearProgress();
      P.clearResume();
      P.clearSendBatches();
      P.saveChannelChoice({ selected: [], known: [] });
      P.startFreshRun();
      patchSync({ savedId: "x" });
    });
    assert.equal(P.loadPicked(A), null);
    assert.equal(P.loadChannelChoice(), null);
    assert.deepEqual(loadSync(), {});
  });
  test("with no localStorage at all (server render) loading is empty, not an error", () => {
    delete g.localStorage;
    assert.equal(P.loadPicked(A), null);
    assert.deepEqual(loadSync(), {});
  });
});

describe("runSync: what this browser knows about the server's copies", () => {
  test("patchSync merges, and a field set to undefined is removed", () => {
    patchSync({ runUpdatedAt: "t1", savedId: "s1" });
    patchSync({ runUpdatedAt: undefined, savedUpdatedAt: "t2" });
    assert.deepEqual(loadSync(), { savedId: "s1", savedUpdatedAt: "t2" });
  });
  test("forgetRun clears every field", () => {
    patchSync({ runUpdatedAt: "t1", savedId: "s1", savedSource: "x", savedUpdatedAt: "t2" });
    forgetRun();
    assert.deepEqual(loadSync(), {});
  });
  test("a corrupt sync record reads as empty", () => {
    store.setItem("pollen-picks:sync", "[1]");
    assert.deepEqual(loadSync(), {});
    store.setItem("pollen-picks:sync", "{bad");
    assert.deepEqual(loadSync(), {});
  });
  const opened = (over = {}) => ({ id: "run", source: "own:pub_1:post_1", link: "https://x.test/a", picks: [4, 5], template: "t=1", format: fmt("sig", { link: "server caption" }), step: 4 as const, newsletter: "N", title: "T", dropped: 0, updatedAt: "2026-11-08T10:00:00.000Z", savedId: null, ...over });
  test("applyOpened REPLACES the browser's run: nothing of the old one survives", () => {
    P.savePicked([1, 2], B);
    P.saveTemplate(tpl(B, "OLD COVER"));
    P.saveFormat(fmt("s", { link: "OLD CAPTION" }));
    applyOpened(opened(), "run");
    const r = JSON.parse(raw()!);
    assert.deepEqual(r.picked, [4, 5]);
    assert.equal(r.scope, "own:pub_1:post_1|https://x.test/a");
    assert.equal(r.format.edited.link, "server caption");
    assert.equal(r.template, undefined);
    assert.ok(!raw()!.includes("OLD"));
    assert.equal(r.progress.step, 4);
  });
  test("applyOpened from the server's run tracks its time; from a saved creation it tracks the creation and not the run slot", () => {
    applyOpened(opened({ savedId: "sid", savedUpdatedAt: "t9" }), "run");
    assert.deepEqual(loadSync(), { runUpdatedAt: "2026-11-08T10:00:00.000Z", savedId: "sid", savedSource: "own:pub_1:post_1", savedUpdatedAt: "t9" });
    applyOpened(opened({ id: "sid2" }), "saved");
    assert.deepEqual(loadSync(), { savedId: "sid2", savedSource: "own:pub_1:post_1", savedUpdatedAt: "2026-11-08T10:00:00.000Z" });
  });
  test("applyOpened without a caption leaves no caption behind", () => {
    P.saveFormat(fmt("s", { link: "OLD CAPTION" }));
    applyOpened(opened({ format: null }), "run");
    assert.equal(P.loadFormat(), null);
  });
  test("openedUrl: each step opens its own page, with the picks and the design", () => {
    const base = { source: "own:pub_1:post_1", picks: [4, 5], template: "" };
    assert.match(openedUrl({ ...base, step: 2 }), /^\/pick/);
    assert.match(openedUrl({ ...base, step: 3 }), /^\/design/);
    assert.match(openedUrl({ ...base, step: 4 }), /^\/write/);
    assert.match(openedUrl({ ...base, step: 5 }), /^\/send/);
    assert.match(openedUrl({ ...base, step: 4 }), /picks=4,5/);
    assert.match(openedUrl({ ...base, template: "spec=abc", step: 3 }), /spec=abc/);
  });
});
