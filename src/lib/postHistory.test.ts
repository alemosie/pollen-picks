import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { fakes } from "../test/setup"; // first: sets the env and the fake network
import { jsonResponse } from "../test/fakes";
import { CAPTION_KEEP_HOURS, historyFacets, listHistory, refreshHistory, requeueFailed } from "./postHistory";

// The log behind the History page. What matters:
//   - an account only ever sees and changes its own rows;
//   - the caption never leaves the server, and is erased after 24 hours for entries that can no longer be retried;
//   - a failed "publish now" and an "unknown" (maybe already in Buffer) entry only go back in the queue after a yes;
//   - Buffer is only asked about recent publish-now posts that have not finished, and one outage never loses what we know.

const A = "user-a";
const B = "user-b";
const HOUR = 3_600_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
let nextId = 1;
type Over = Record<string, unknown>;
function row(over: Over = {}) {
  const r = {
    id: nextId++,
    user_id: A,
    post_id: null,
    service: "instagram",
    channel_name: "IG",
    channel_id: "ch-1",
    mode: "draft",
    newsletter: "N",
    issue_title: "T",
    slides: 4,
    status: "draft",
    live_url: null,
    error: null,
    batch_id: null,
    created_at: ago(HOUR),
    attempts: 0,
    caption: null,
    not_before: null,
    lease_until: null,
    ...over,
  };
  fakes.supabase.rows("post_history").push(r);
  return r;
}
const stored = (id: number) => fakes.supabase.rows("post_history").find((r) => r.id === id)!;

beforeEach(() => {
  fakes.reset();
  nextId = 1;
});

describe("listHistory", () => {
  test("only this account's rows, newest first", async () => {
    const old = row({ created_at: ago(5 * HOUR) });
    const mid = row({ created_at: ago(3 * HOUR) });
    row({ user_id: B });
    const fresh = row({ created_at: ago(HOUR) });
    assert.deepEqual((await listHistory(A)).map((e) => e.id), [fresh.id, mid.id, old.id]);
    assert.equal((await listHistory(B)).length, 1);
  });
  test("rows made at the same moment are ordered by id, newest first", async () => {
    const at = ago(HOUR);
    const a = row({ created_at: at });
    const b = row({ created_at: at });
    assert.deepEqual((await listHistory(A)).map((e) => e.id), [b.id, a.id]);
  });
  test("a limit", async () => {
    for (let i = 0; i < 5; i++) row({ created_at: ago(i * HOUR + 1) });
    assert.equal((await listHistory(A, { limit: 2 })).length, 2);
  });
  test("one send: only its batch", async () => {
    const x = row({ batch_id: "batch-x" });
    row({ batch_id: "batch-y" });
    row({});
    assert.deepEqual((await listHistory(A, { batchId: "batch-x" })).map((e) => e.id), [x.id]);
  });
  test("another account's batch id shows nothing", async () => {
    row({ user_id: B, batch_id: "batch-x" });
    assert.equal((await listHistory(A, { batchId: "batch-x" })).length, 0);
  });
  test("filters: network, channel, mode, and status group", async () => {
    const li = row({ service: "LinkedIn", channel_id: "ch-2", mode: "now", status: "sent" });
    row({ service: "instagram", channel_id: "ch-1", mode: "draft", status: "draft" });
    row({ service: "instagram", channel_id: "ch-1", mode: "now", status: "failed" });
    assert.equal((await listHistory(A, { filters: { channelId: "ch-2" } })).length, 1);
    assert.equal((await listHistory(A, { filters: { mode: "now" } })).length, 2);
    assert.equal((await listHistory(A, { filters: { status: "failed" } })).length, 1);
    assert.equal((await listHistory(A, { filters: { status: "done" } })).length, 2);
    assert.equal((await listHistory(A, { filters: { mode: "now", status: "done" } })).map((e) => e.id).join(), String(li.id));
    // the network filter is matched in lower case, as the facets give it
    assert.equal((await listHistory(A, { filters: { service: "instagram" } })).length, 2);
  });
  test("the status groups hold what the History page promises", async () => {
    for (const s of ["queued", "working", "sending", "scheduled"]) row({ status: s });
    for (const s of ["sent", "draft"]) row({ status: s });
    for (const s of ["failed", "error"]) row({ status: s });
    for (const s of ["unknown", "needs_approval"]) row({ status: s });
    assert.equal((await listHistory(A, { filters: { status: "progress" } })).length, 4);
    assert.equal((await listHistory(A, { filters: { status: "done" } })).length, 2);
    assert.equal((await listHistory(A, { filters: { status: "failed" } })).length, 2);
    assert.equal((await listHistory(A, { filters: { status: "check" } })).length, 2);
  });
  test("an entry never carries its caption, only whether there is one", async () => {
    row({ status: "failed", caption: "SECRET CAPTION TEXT" });
    const list = await listHistory(A);
    assert.ok(!JSON.stringify(list).includes("SECRET CAPTION"));
    assert.equal(list[0].retryable, true);
  });
  test("a failed read is an error, not an empty history", async () => {
    fakes.supabase.failTable["post_history"] = { status: 500, message: "boom" };
    await assert.rejects(listHistory(A), /Could not read your history/);
  });
});

describe("what an entry says about itself", () => {
  test("held up: queued and already tried once (a rate limit), not just waiting its turn", async () => {
    row({ status: "queued", attempts: 0 });
    row({ status: "queued", attempts: 2 });
    row({ status: "failed", attempts: 2 });
    const [failed, held, waiting] = await listHistory(A);
    assert.equal(waiting.heldUp, false);
    assert.equal(held.heldUp, true);
    assert.equal(failed.heldUp, false);
  });
  test("failed with a caption: retryable until 24 hours after it was made", async () => {
    const r = row({ status: "failed", caption: "c", created_at: ago(HOUR) });
    const [e] = await listHistory(A);
    assert.equal(e.retryable, true);
    assert.equal(e.resendable, false);
    assert.equal(new Date(e.retryUntil!).getTime(), new Date(r.created_at as string).getTime() + CAPTION_KEEP_HOURS * HOUR);
  });
  test("unknown with a caption: can be sent again (after a warning), not retried", async () => {
    row({ status: "unknown", caption: "c" });
    const [e] = await listHistory(A);
    assert.equal(e.resendable, true);
    assert.equal(e.retryable, false);
    assert.ok(e.retryUntil);
  });
  test("no caption: nothing to retry or resend, and no deadline", async () => {
    row({ status: "failed", caption: null });
    row({ status: "unknown", caption: null });
    for (const e of await listHistory(A)) assert.deepEqual([e.retryable, e.resendable, e.retryUntil], [false, false, null]);
  });
  test("a finished post is never retryable, even if a caption is somehow still there", async () => {
    row({ status: "sent", caption: "c" });
    const [e] = await listHistory(A);
    assert.deepEqual([e.retryable, e.resendable, e.retryUntil], [false, false, null]);
  });
});

describe("old captions are erased whenever the history is read", () => {
  test("failed and unknown entries older than 24 hours lose their caption; younger ones keep it", async () => {
    const oldFailed = row({ status: "failed", caption: "x", created_at: ago(25 * HOUR) });
    const oldUnknown = row({ status: "unknown", caption: "x", created_at: ago(30 * HOUR) });
    const youngFailed = row({ status: "failed", caption: "x", created_at: ago(23 * HOUR) });
    await listHistory(A);
    assert.equal(stored(oldFailed.id).caption, null);
    assert.equal(stored(oldUnknown.id).caption, null);
    assert.equal(stored(youngFailed.id).caption, "x");
  });
  test("only this account's captions are touched", async () => {
    const theirs = row({ user_id: B, status: "failed", caption: "x", created_at: ago(48 * HOUR) });
    await listHistory(A);
    assert.equal(stored(theirs.id).caption, "x");
  });
  test("an erased entry can no longer be retried", async () => {
    const r = row({ status: "failed", caption: "x", created_at: ago(25 * HOUR) });
    assert.deepEqual(await requeueFailed(A, [r.id], true), { requeued: 0, needsConfirm: 0 });
    assert.equal(stored(r.id).status, "failed");
  });
});

describe("requeueFailed: putting failed entries back in the queue", () => {
  test("a failed draft goes back: queued, error cleared, tries reset, lease dropped", async () => {
    const r = row({ status: "failed", mode: "draft", caption: "c", error: "boom", attempts: 3, not_before: "2030-01-01", lease_until: "2030-01-01" });
    assert.deepEqual(await requeueFailed(A, [r.id]), { requeued: 1, needsConfirm: 0 });
    const s = stored(r.id);
    assert.deepEqual([s.status, s.error, s.attempts, s.not_before, s.lease_until], ["queued", null, 0, null, null]);
  });
  test("a failed publish-now entry needs a yes first, and nothing changes without it", async () => {
    const draft = row({ status: "failed", mode: "draft", caption: "c" });
    const live = row({ status: "failed", mode: "now", caption: "c" });
    assert.deepEqual(await requeueFailed(A, [draft.id, live.id]), { requeued: 0, needsConfirm: 1 });
    assert.equal(stored(draft.id).status, "failed", "the safe one waits too: all or nothing");
    assert.equal(stored(live.id).status, "failed");
  });
  test("with the yes, a publish-now entry goes back", async () => {
    const live = row({ status: "failed", mode: "now", caption: "c" });
    assert.deepEqual(await requeueFailed(A, [live.id], true), { requeued: 1, needsConfirm: 0 });
    assert.equal(stored(live.id).status, "queued");
  });
  test("an unknown entry (maybe already in Buffer) is never picked up by a plain retry, even confirmed", async () => {
    const u = row({ status: "unknown", mode: "draft", caption: "c" });
    assert.deepEqual(await requeueFailed(A, [u.id], true), { requeued: 0, needsConfirm: 0 });
    assert.equal(stored(u.id).status, "unknown");
  });
  test("send again: an unknown entry needs the yes, and goes back with it", async () => {
    const u = row({ status: "unknown", mode: "draft", caption: "c" });
    assert.deepEqual(await requeueFailed(A, [u.id], false, true), { requeued: 0, needsConfirm: 1 });
    assert.equal(stored(u.id).status, "unknown");
    assert.deepEqual(await requeueFailed(A, [u.id], true, true), { requeued: 1, needsConfirm: 0 });
    assert.equal(stored(u.id).status, "queued");
  });
  test("an entry whose caption is gone cannot go back", async () => {
    const r = row({ status: "failed", caption: null });
    assert.deepEqual(await requeueFailed(A, [r.id], true), { requeued: 0, needsConfirm: 0 });
  });
  test("entries that are not failed are left alone: sent, queued, working, draft", async () => {
    const ids = ["sent", "queued", "working", "draft", "error"].map((status) => row({ status, caption: "c" }).id);
    assert.deepEqual(await requeueFailed(A, ids, true, true), { requeued: 0, needsConfirm: 0 });
    assert.deepEqual(ids.map((i) => stored(i).status), ["sent", "queued", "working", "draft", "error"]);
  });
  test("another account's entries are never touched, with or without the yes", async () => {
    const r = row({ user_id: B, status: "failed", mode: "now", caption: "c" });
    assert.deepEqual(await requeueFailed(A, [r.id]), { requeued: 0, needsConfirm: 0 });
    assert.deepEqual(await requeueFailed(A, [r.id], true, true), { requeued: 0, needsConfirm: 0 });
    assert.equal(stored(r.id).status, "failed");
  });
  test("only the ids asked for", async () => {
    const a = row({ status: "failed", caption: "c" });
    const b = row({ status: "failed", caption: "c" });
    await requeueFailed(A, [a.id]);
    assert.equal(stored(a.id).status, "queued");
    assert.equal(stored(b.id).status, "failed");
  });
  test("a database error is an error, not 'nothing to retry'", async () => {
    const r = row({ status: "failed", caption: "c" });
    fakes.supabase.failTable["post_history"] = { status: 500, message: "boom" };
    await assert.rejects(requeueFailed(A, [r.id]));
  });
});

describe("historyFacets", () => {
  test("networks lower-cased and sorted, channels once each with the newest name, other accounts excluded", async () => {
    row({ service: "LinkedIn", channel_id: "c2", channel_name: "Old name", created_at: ago(5 * HOUR) });
    row({ service: "linkedin", channel_id: "c2", channel_name: "New name", created_at: ago(1 * HOUR) });
    row({ service: "instagram", channel_id: "c1", channel_name: "", created_at: ago(2 * HOUR) });
    row({ service: "threads", channel_id: null, created_at: ago(3 * HOUR) });
    row({ user_id: B, service: "mastodon", channel_id: "c9" });
    const f = await historyFacets(A);
    assert.deepEqual(f.services, ["instagram", "linkedin", "threads"]);
    assert.deepEqual(f.channels, [
      { id: "c2", name: "New name", service: "linkedin" },
      { id: "c1", name: "instagram", service: "instagram" },
    ]);
  });
  test("an account with no history has no facets", async () => {
    assert.deepEqual(await historyFacets(A), { services: [], channels: [] });
  });
});

describe("refreshHistory: asking Buffer where publish-now posts stand", () => {
  const stateOf = (map: Record<string, { status: string; externalLink?: string } | null>) => {
    fakes.graphql = (query) => {
      const data: Record<string, unknown> = {};
      for (const m of query.matchAll(/(p\d+): post\(input: \{ id: "([^"]+)" \}\)/g)) {
        const s = map[m[2]];
        data[m[1]] = s ? { id: m[2], status: s.status, sentAt: null, externalLink: s.externalLink ?? null } : null;
      }
      return jsonResponse({ data });
    };
  };
  const asked = () => fakes.graphqlCalls.flatMap((c) => [...c.query.matchAll(/id: "([^"]+)"/g)].map((m) => m[1]));

  test("a post that is still going out gets its new status and live link, and is stamped as checked", async () => {
    const r = row({ mode: "now", post_id: "bp-1", status: "sending" });
    stateOf({ "bp-1": { status: "sent", externalLink: "https://x.test/live" } });
    const list = await refreshHistory(A, "tok");
    assert.equal(stored(r.id).status, "sent");
    assert.equal(stored(r.id).live_url, "https://x.test/live");
    assert.ok(stored(r.id).checked_at);
    assert.equal(list[0].status, "sent");
    assert.equal(list[0].liveUrl, "https://x.test/live");
    assert.equal(fakes.graphqlCalls[0].token, "tok", "uses the person's own Buffer token");
  });
  test("one request covers several posts", async () => {
    for (let i = 1; i <= 4; i++) row({ mode: "now", post_id: `bp-${i}`, status: "sending" });
    stateOf({ "bp-1": { status: "sent" }, "bp-2": { status: "sent" }, "bp-3": { status: "sending" }, "bp-4": { status: "error" } });
    await refreshHistory(A, "tok");
    assert.equal(fakes.graphqlCalls.length, 1);
    assert.equal(asked().length, 4);
  });
  test("final statuses, rows with no post id, other accounts, and posts older than 14 days are never asked about", async () => {
    for (const s of ["sent", "error", "needs_approval", "draft", "failed", "unknown"]) row({ mode: "now", post_id: `final-${s}`, status: s });
    row({ mode: "now", post_id: null, status: "sending" });
    row({ user_id: B, mode: "now", post_id: "theirs", status: "sending" });
    row({ mode: "now", post_id: "ancient", status: "sending", created_at: ago(15 * 24 * HOUR) });
    const ok = row({ mode: "now", post_id: "recent", status: "sending", created_at: ago(13 * 24 * HOUR) });
    stateOf({ recent: { status: "sent" } });
    await refreshHistory(A, "tok");
    assert.deepEqual(asked(), ["recent"]);
    assert.equal(stored(ok.id).status, "sent");
  });
  test("nothing to ask: Buffer is not called at all", async () => {
    row({ mode: "now", post_id: "x", status: "sent" });
    await refreshHistory(A, "tok");
    assert.equal(fakes.graphqlCalls.length, 0);
  });
  test("no more than 25 at a time, newest first", async () => {
    for (let i = 0; i < 30; i++) row({ mode: "now", post_id: `bp-${i}`, status: "sending", created_at: ago((i + 1) * 1000) });
    stateOf({});
    await refreshHistory(A, "tok");
    assert.equal(asked().length, 25);
    assert.ok(!asked().includes("bp-29") && asked().includes("bp-0"));
  });
  test("Buffer does not know the post: the status we have is kept (and it is not asked about again by mistake as final)", async () => {
    const r = row({ mode: "now", post_id: "bp-1", status: "sending" });
    stateOf({ "bp-1": null });
    await refreshHistory(A, "tok");
    assert.equal(stored(r.id).status, "sending");
    assert.ok(stored(r.id).checked_at);
  });
  test("a Buffer outage keeps everything we knew and does not throw", async () => {
    const r = row({ mode: "now", post_id: "bp-1", status: "sending", live_url: "https://old" });
    fakes.graphql = () => new Response("down", { status: 500 });
    const list = await refreshHistory(A, "tok");
    assert.equal(stored(r.id).status, "sending");
    assert.equal(stored(r.id).live_url, "https://old");
    assert.equal(list[0].status, "sending");
  });
  test("a network failure keeps everything we knew and does not throw", async () => {
    const r = row({ mode: "now", post_id: "bp-1", status: "sending" });
    fakes.graphql = () => {
      throw new Error("socket hang up");
    };
    await refreshHistory(A, "tok");
    assert.equal(stored(r.id).status, "sending");
  });
  test("the answer respects the batch and the filters it was asked for", async () => {
    row({ mode: "now", post_id: "bp-1", status: "sending", batch_id: "b1", service: "instagram" });
    row({ mode: "now", post_id: "bp-2", status: "sending", batch_id: "b2", service: "linkedin" });
    stateOf({ "bp-1": { status: "sent" }, "bp-2": { status: "sent" } });
    const list = await refreshHistory(A, "tok", { batchId: "b1" });
    assert.deepEqual(list.map((e) => e.postId), ["bp-1"]);
    const li = await refreshHistory(A, "tok", { filters: { service: "linkedin" } });
    assert.deepEqual(li.map((e) => e.postId), ["bp-2"]);
  });
  describe("old drafts", () => {
    const pid = (r: { post_id?: unknown }) => String(r.post_id);
    const old = (days: number, over: Record<string, unknown> = {}) =>
      row({ mode: "draft", status: "draft", post_id: `d-${days}-${Math.random().toString(36).slice(2, 6)}`, created_at: ago(days * 24 * HOUR), ...over });

    test("a draft that Buffer now says went out stops being a draft, and gets its live link", async () => {
      const r = old(12);
      stateOf({ [pid(r)]: { status: "sent", externalLink: "https://x.test/live" } });
      const list = await refreshHistory(A, "tok");
      assert.equal(stored(r.id).status, "sent");
      assert.equal(stored(r.id).live_url, "https://x.test/live");
      assert.equal(list.find((e) => e.id === r.id)?.status, "sent");
    });
    test("a scheduled draft is recorded as scheduled", async () => {
      const r = old(20);
      stateOf({ [pid(r)]: { status: "scheduled" } });
      await refreshHistory(A, "tok");
      assert.equal(stored(r.id).status, "scheduled");
    });
    test("a draft that is still a draft stays one, and is stamped as checked", async () => {
      const r = old(12);
      stateOf({ [pid(r)]: { status: "draft" } });
      await refreshHistory(A, "tok");
      assert.equal(stored(r.id).status, "draft");
      assert.ok(stored(r.id).checked_at);
    });
    test("every draft is asked about on every load, whatever its age or when it was last checked", async () => {
      const young = old(0.1, { checked_at: ago(1000) });
      const mid = old(5);
      const ancient = old(200);
      stateOf({ [pid(young)]: { status: "sent", externalLink: "https://x.test/live" }, [pid(mid)]: { status: "draft" }, [pid(ancient)]: { status: "scheduled" } });
      await refreshHistory(A, "tok");
      assert.deepEqual(asked().sort(), [pid(young), pid(mid), pid(ancient)].sort());
      assert.equal(stored(young.id).status, "sent");
      assert.equal(stored(young.id).live_url, "https://x.test/live");
      assert.equal(stored(ancient.id).status, "scheduled");
      await refreshHistory(A, "tok");
      assert.equal(fakes.graphqlCalls.length, 2, "asked again on the next load");
    });
    test("drafts with no post id, other accounts' drafts, and drafts that already moved on are not asked about", async () => {
      old(12, { post_id: null });
      old(12, { user_id: B, post_id: "theirs" });
      old(12, { status: "sent", post_id: "out" });
      old(12, { status: "removed", post_id: "gone" });
      const ask = old(12, { post_id: "asked" });
      stateOf({ asked: { status: "draft" } });
      await refreshHistory(A, "tok");
      assert.deepEqual(asked(), ["asked"]);
      assert.equal(stored(ask.id).status, "draft");
    });
    test("Buffer not knowing the draft, or being down, leaves it a draft", async () => {
      const r = old(12);
      stateOf({ [pid(r)]: null });
      await refreshHistory(A, "tok");
      assert.equal(stored(r.id).status, "draft");
      fakes.graphql = () => new Response("down", { status: 500 });
      await refreshHistory(A, "tok");
      assert.equal(stored(r.id).status, "draft");
    });
    test("a draft Buffer says it can't find (deleted there) is marked removed, and is not asked about again", async () => {
      const r = old(12);
      fakes.graphql = (query) => {
        const data: Record<string, unknown> = {};
        for (const m of query.matchAll(/(p\d+): post\(input: \{ id: "([^"]+)" \}\)/g)) data[m[1]] = null;
        return jsonResponse({ data, errors: [{ message: "Post not found", path: ["p0"], extensions: { code: "NOT_FOUND" } }] });
      };
      const list = await refreshHistory(A, "tok");
      assert.equal(stored(r.id).status, "removed");
      assert.equal(list.find((e) => e.id === r.id)?.status, "removed");
      const before = fakes.graphqlCalls.length;
      await refreshHistory(A, "tok");
      assert.equal(fakes.graphqlCalls.length, before, "a removed draft is final");
    });
    test("a publish-now post that comes back not found keeps its status (only drafts are marked removed)", async () => {
      const r = row({ mode: "now", post_id: "bp-1", status: "sending" });
      fakes.graphql = () => jsonResponse({ data: { p0: null }, errors: [{ message: "Post not found", path: ["p0"], extensions: { code: "NOT_FOUND" } }] });
      await refreshHistory(A, "tok");
      assert.equal(stored(r.id).status, "sending");
    });
    test("a scheduled draft keeps being asked about, and gets its live link once it is out", async () => {
      const r = old(3, { status: "scheduled" });
      stateOf({ [pid(r)]: { status: "scheduled" } });
      await refreshHistory(A, "tok");
      assert.equal(stored(r.id).status, "scheduled");
      stateOf({ [pid(r)]: { status: "sent", externalLink: "https://x.test/live" } });
      const list = await refreshHistory(A, "tok");
      assert.equal(stored(r.id).status, "sent");
      assert.equal(list.find((e) => e.id === r.id)?.liveUrl, "https://x.test/live");
    });
    test("up to 100 drafts are asked about, 25 to a request", async () => {
      for (let i = 0; i < 110; i++) old(1 + i / 1000, { post_id: `bulk-${i}` });
      stateOf({});
      await refreshHistory(A, "tok");
      assert.equal(asked().length, 100);
      assert.equal(fakes.graphqlCalls.length, 4);
    });
    test("while posts are still in our send queue, drafts are not asked about (sending has the rate limit first)", async () => {
      row({ mode: "draft", status: "queued", post_id: null });
      old(12, { post_id: "waiting" });
      stateOf({ waiting: { status: "sent" } });
      await refreshHistory(A, "tok");
      assert.equal(fakes.graphqlCalls.length, 0);
    });
    test("sending posts and old drafts share one request", async () => {
      row({ mode: "now", post_id: "bp-1", status: "sending" });
      const r = old(12);
      stateOf({ "bp-1": { status: "sent" }, [pid(r)]: { status: "sent" } });
      await refreshHistory(A, "tok");
      assert.equal(fakes.graphqlCalls.length, 1);
      assert.equal(asked().length, 2);
    });
  });
  test("a status longer than the column is cut, not rejected", async () => {
    const r = row({ mode: "now", post_id: "bp-1", status: "sending" });
    stateOf({ "bp-1": { status: "x".repeat(60) } });
    await refreshHistory(A, "tok");
    assert.equal((stored(r.id).status as string).length, 30);
  });
});
