import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { fakes } from "../test/setup"; // first: sets the env and the fake network
import { deleteRun, getRun, putRun, runStatus, saveRunAsCreation } from "./currentRun";
import { addCustomChunk, clearCustomChunks, listCustomChunks, removeCustomChunk } from "./customPicks";
import { deleteCreation, getCreation, getCreationBySource, listCreations, saveCreation, updateCreation } from "./savedCreations";
import type { CreationInput } from "./savedCreationShape";

// The server's copies of a run: the ONE current run per account, the saved creations, and the highlights. The rules that matter:
//   - a different account never sees or changes another's rows;
//   - a write that did not see the stored run's latest change is refused (409), never silently applied;
//   - discarding really removes the run, and a new run of the SAME issue starts empty;
//   - starting over wipes highlights, except the ones a saved creation uses.

const A = "user-a";
const B = "user-b";
const S1 = "own:pub_1:post_1";
const S2 = "own:pub_1:post_2";
const tpl = "";
const fmt = (sig: string, edited: Record<string, string> = {}) => ({ sig, order: "clicks", edited, tab: "link" });
const input = (over: Partial<CreationInput> = {}): CreationInput => ({
  source: S1,
  link: "https://x.test/p/1",
  picks: [1, 2],
  template: tpl,
  format: null,
  step: 3,
  newsletter: "N",
  title: "T",
  ...over,
});
const put = (user: string, c: CreationInput, o: Partial<{ ifUpdatedAt: string | null; force: boolean; savedId: string | null }> = {}) =>
  putRun(user, c, { ifUpdatedAt: null, force: false, savedId: null, ...o });
const wait = (ms = 5) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => fakes.reset());

describe("current run: one slot per account", () => {
  test("nothing stored: no run, nothing unsaved", async () => {
    assert.equal(await getRun(A), null);
    assert.deepEqual(await runStatus(A), { run: null, unsaved: false, hasSavedForIssue: false, unsavedHighlights: 0 });
  });
  test("a first write is stored and read back whole", async () => {
    const r = await put(A, input());
    assert.ok("updatedAt" in r);
    const got = await getRun(A);
    assert.deepEqual(got?.picks, [1, 2]);
    assert.equal(got?.source, S1);
  });
  test("another account never sees it, and cannot discard it", async () => {
    await put(A, input());
    assert.equal(await getRun(B), null);
    await deleteRun(B);
    assert.ok(await getRun(A));
  });
  test("one row per account: a run of another issue REPLACES it", async () => {
    await put(A, input());
    await put(A, input({ source: S2, picks: [9] }));
    assert.equal(fakes.supabase.rows("current_runs").length, 1);
    assert.equal((await getRun(A))?.source, S2);
  });
});

describe("current run: the conflict rule", () => {
  test("same issue, a writer that never saw the run (no ifUpdatedAt): refused, nothing changes", async () => {
    await put(A, input());
    const r = await put(A, input({ picks: [5, 6] }));
    assert.ok("conflict" in r);
    assert.deepEqual((await getRun(A))?.picks, [1, 2]);
  });
  test("same issue, the writer saw the latest write: accepted", async () => {
    const first = (await put(A, input())) as { updatedAt: string };
    await wait();
    const r = await put(A, input({ picks: [5, 6] }), { ifUpdatedAt: first.updatedAt });
    assert.ok("updatedAt" in r);
    assert.deepEqual((await getRun(A))?.picks, [5, 6]);
  });
  test("same issue, the writer saw an OLDER write: refused", async () => {
    const first = (await put(A, input())) as { updatedAt: string };
    await wait();
    await put(A, input({ picks: [3] }), { ifUpdatedAt: first.updatedAt });
    const r = await put(A, input({ picks: [7] }), { ifUpdatedAt: first.updatedAt });
    assert.ok("conflict" in r);
    assert.deepEqual((await getRun(A))?.picks, [3]);
  });
  test("force ('keep mine') always writes", async () => {
    await put(A, input());
    const r = await put(A, input({ picks: [8] }), { force: true });
    assert.ok("updatedAt" in r);
    assert.deepEqual((await getRun(A))?.picks, [8]);
  });
  test("a writer that holds exactly what is stored loses nothing: accepted without ifUpdatedAt", async () => {
    await put(A, input());
    assert.ok("updatedAt" in (await put(A, input())));
  });
  test("after a discard the slot is empty, so a stale autosave of the same issue lands (the server alone cannot stop it; the Pick page's fresh key does)", async () => {
    // This is the documented behaviour (nothing stored = nothing to conflict with). The Pick page's fresh key is what keeps a hidden old page from writing.
    const first = (await put(A, input())) as { updatedAt: string };
    await deleteRun(A);
    const r = await put(A, input({ picks: [1, 2] }), { ifUpdatedAt: first.updatedAt });
    assert.ok("updatedAt" in r, "documents that the server alone does not stop a stale autosave after a discard");
  });
  test("a write from a stale screen keeps the stored captions it never had", async () => {
    const sig = `${input().link}|1,2|`;
    await put(A, input({ format: fmt(sig, { link: "my caption" }) }));
    const r = await put(A, input({ format: fmt(sig, {}) }), { force: true });
    assert.ok("updatedAt" in r);
    assert.equal((await getRun(A))?.format?.edited.link, "my caption");
  });
  test("a screen's own captions win over the stored ones", async () => {
    const sig = `${input().link}|1,2|`;
    await put(A, input({ format: fmt(sig, { link: "old" }) }));
    await put(A, input({ format: fmt(sig, { link: "new" }) }), { force: true });
    assert.equal((await getRun(A))?.format?.edited.link, "new");
  });
  test("captions saved for OTHER picks are not carried over", async () => {
    await put(A, input({ format: fmt(`${input().link}|1,2|`, { link: "for the old picks" }) }));
    await put(A, input({ picks: [4], format: fmt(`${input().link}|4|`, {}) }), { force: true });
    assert.deepEqual((await getRun(A))?.format?.edited, {});
  });
});

describe("current run: discard and a new run of the same issue", () => {
  test("discard removes the run entirely", async () => {
    await put(A, input({ format: fmt(`${input().link}|1,2|`, { link: "caption" }) }));
    await deleteRun(A);
    assert.equal(await getRun(A), null);
    assert.equal(fakes.supabase.rows("current_runs").length, 0);
  });
  test("a new run of the SAME issue after a discard holds nothing from the old one", async () => {
    await put(A, input({ picks: [1, 2], template: "t=old", format: fmt(`${input().link}|1,2|t=old`, { link: "old caption" }) }));
    await deleteRun(A);
    await put(A, input({ picks: [3], template: "", format: null }));
    const got = await getRun(A);
    assert.deepEqual(got?.picks, [3]);
    assert.equal(got?.template, "");
    assert.equal(got?.format, null);
    assert.ok(!JSON.stringify(fakes.supabase.rows("current_runs")).includes("old caption"));
  });
  test("discard with a source only removes the run of THAT issue (a send of one issue must not delete another's)", async () => {
    await put(A, input({ source: S2, picks: [9] }));
    await deleteRun(A, S1);
    assert.ok(await getRun(A));
    await deleteRun(A, S2);
    assert.equal(await getRun(A), null);
  });
  test("a failed DELETE is an error (so the caller can tell), and the run survives", async () => {
    await put(A, input());
    fakes.supabase.failTable["current_runs"] = { status: 500, message: "boom" };
    await assert.rejects(deleteRun(A), /Could not discard/);
    delete fakes.supabase.failTable["current_runs"];
    assert.ok(await getRun(A));
  });
  test("a failed read is an error, not 'no run'", async () => {
    fakes.supabase.failTable["current_runs"] = { status: 500, message: "boom" };
    await assert.rejects(getRun(A), /Could not read your current run/);
    await assert.rejects(put(A, input()), /Could not save your run/);
  });
});

describe("saved creations", () => {
  test("saving replaces the account's earlier creation for the SAME issue (one per issue)", async () => {
    await saveCreation(A, input({ picks: [1] }));
    await saveCreation(A, input({ picks: [2] }));
    assert.equal(fakes.supabase.rows("saved_creations").length, 1);
    assert.deepEqual((await getCreationBySource(A, S1))?.picks, [2]);
  });
  test("different issues are kept side by side; other accounts see none of them", async () => {
    await saveCreation(A, input());
    await saveCreation(A, input({ source: S2 }));
    assert.equal((await listCreations(A)).length, 2);
    assert.equal((await listCreations(B)).length, 0);
    assert.equal(await getCreationBySource(B, S1), null);
  });
  test("another account cannot open, update or delete it", async () => {
    const { id } = await saveCreation(A, input());
    assert.equal(await getCreation(B, id), null);
    assert.equal(await updateCreation(B, id, input({ picks: [9] }), null, true), "gone");
    assert.equal(await deleteCreation(B, id), false);
    assert.deepEqual((await getCreationBySource(A, S1))?.picks, [1, 2]);
  });
  test("update: a stale writer is refused; the one who saw the latest write is accepted; force always works", async () => {
    const { id, updatedAt } = await saveCreation(A, input());
    await wait();
    const ok = await updateCreation(A, id, input({ picks: [3] }), updatedAt, false);
    assert.ok(typeof ok === "object" && "updatedAt" in ok);
    const stale = await updateCreation(A, id, input({ picks: [4] }), updatedAt, false);
    assert.ok(typeof stale === "object" && "conflict" in stale);
    assert.deepEqual((await getCreationBySource(A, S1))?.picks, [3]);
    const forced = await updateCreation(A, id, input({ picks: [5] }), null, true);
    assert.ok(typeof forced === "object" && "updatedAt" in forced);
  });
  test("update never brings a DELETED creation back", async () => {
    const { id, updatedAt } = await saveCreation(A, input());
    assert.equal(await deleteCreation(A, id), true);
    assert.equal(await updateCreation(A, id, input(), updatedAt, true), "gone");
    assert.equal(fakes.supabase.rows("saved_creations").length, 0);
  });
  test("a creation belongs to one issue: an update for another issue is refused", async () => {
    const { id } = await saveCreation(A, input());
    assert.equal(await updateCreation(A, id, input({ source: S2 }), null, true), "gone");
  });
  test("the list never carries caption text, only whether there is one", async () => {
    await saveCreation(A, input({ format: fmt(`${input().link}|1,2|`, { link: "SECRET CAPTION" }) }));
    const list = await listCreations(A);
    assert.equal(list[0].hasCaption, true);
    assert.ok(!JSON.stringify(list).includes("SECRET CAPTION"));
  });
});

describe("run status and 'save it first'", () => {
  test("a run with no saved creation is unsaved", async () => {
    await put(A, input());
    const s = await runStatus(A);
    assert.equal(s.unsaved, true);
    assert.equal(s.hasSavedForIssue, false);
    assert.equal(s.run?.picks, 2);
  });
  test("a run equal to its saved creation has nothing unsaved; a changed one does", async () => {
    await saveCreation(A, input());
    await put(A, input());
    assert.deepEqual(await runStatus(A), { run: (await runStatus(A)).run, unsaved: false, hasSavedForIssue: true, unsavedHighlights: 0 });
    await put(A, input({ picks: [1, 2, 3] }), { force: true });
    assert.equal((await runStatus(A)).unsaved, true);
  });
  test("another issue's saved creation does not make this run 'saved'", async () => {
    await saveCreation(A, input({ source: S2 }));
    await put(A, input());
    const s = await runStatus(A);
    assert.equal(s.unsaved, true);
    assert.equal(s.hasSavedForIssue, false);
  });
  test("saveRunAsCreation: false with no run; otherwise saves, and a run still at Pick is saved as Design", async () => {
    assert.equal(await saveRunAsCreation(A), false);
    await put(A, input({ step: 2 }));
    assert.equal(await saveRunAsCreation(A), true);
    assert.equal((await getCreationBySource(A, S1))?.step, 3);
  });
  test("the saved-id link is only kept when it is this account's own creation for that issue", async () => {
    const mine = await saveCreation(A, input());
    const theirs = await saveCreation(B, input());
    await put(A, input(), { savedId: theirs.id });
    assert.equal((await getRun(A))?.savedId, null);
    await put(A, input(), { savedId: mine.id, force: true });
    assert.equal((await getRun(A))?.savedId, mine.id);
  });
});

describe("highlights (custom picks)", () => {
  const add = (user: string, issue: string, text: string) => addCustomChunk(user, issue, text, null);
  test("a highlight is stored for one account and one issue only", async () => {
    await add(A, "p:1", "hello");
    assert.equal((await listCustomChunks(A, "p:1")).length, 1);
    assert.equal((await listCustomChunks(A, "p:2")).length, 0);
    assert.equal((await listCustomChunks(B, "p:1")).length, 0);
  });
  test("starting over wipes the account's highlights and nobody else's", async () => {
    await add(A, "p:1", "mine");
    await add(B, "p:1", "theirs");
    await clearCustomChunks(A);
    assert.equal((await listCustomChunks(A, "p:1")).length, 0);
    assert.equal((await listCustomChunks(B, "p:1")).length, 1);
  });
  test("starting over keeps the highlights a SAVED creation uses, and drops the rest", async () => {
    const used = (await add(A, "p:1", "used"))!;
    await add(A, "p:1", "not used");
    await saveCreation(A, input({ picks: [used.id as number] }));
    await clearCustomChunks(A);
    const left = await listCustomChunks(A, "p:1");
    assert.deepEqual(left.map((c) => c.id), [used.id]);
  });
  test("removing one highlight only removes the owner's row for that issue", async () => {
    const mine = (await add(A, "p:1", "mine"))!;
    const theirs = (await add(B, "p:1", "theirs"))!;
    await removeCustomChunk(B, "p:1", mine.id as number); // someone else's id: no effect
    assert.equal((await listCustomChunks(A, "p:1")).length, 1);
    await removeCustomChunk(A, "p:2", mine.id as number); // wrong issue: no effect
    assert.equal((await listCustomChunks(A, "p:1")).length, 1);
    await removeCustomChunk(A, "p:1", mine.id as number);
    assert.equal((await listCustomChunks(A, "p:1")).length, 0);
    assert.equal((await listCustomChunks(B, "p:1")).length, 1);
    void theirs;
  });
  test("a failed clear is an error, not silence", async () => {
    fakes.supabase.failTable["custom_picks"] = { status: 500, message: "boom" };
    await assert.rejects(clearCustomChunks(A), /Could not clear highlights/);
  });
});
