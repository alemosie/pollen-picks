import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { fakes } from "../../test/setup"; // first: sets the env and the fake network
import { inRequest, makeRequest } from "../../test/request";
import { checkKey } from "../../lib/beehiiv";
import { FAKE_KEY } from "../../lib/fakeBeehiiv";
import { getRun } from "../../lib/currentRun";
import { getCreation, saveCreation } from "../../lib/savedCreations";
import { addCustomChunk } from "../../lib/customPicks";
import { DELETE as runDelete, GET as runGet, PUT as runPut } from "./run/route";
import { POST as runSave } from "./run/save/route";
import { POST as savedPost } from "./saved/route";
import { DELETE as savedDelete, GET as savedGet, PATCH as savedPatch } from "./saved/[id]/route";

// The routes behind the "this screen doesn't match the saved run" banners. Two devices are two writers on ONE account: each remembers the time the
// server gave its last write (`ifUpdatedAt`). The rules:
//   - a write that did not see the latest change is refused (409) and changes nothing, and the answer says when the server's copy was saved;
//   - "keep mine" (force) wins; "load theirs" reads the server's copy;
//   - a deleted saved creation answers 404 and is never brought back;
//   - another account's rows are never reachable, and a request from another site is refused.

const ORIGIN = "https://pollen.test";
const SOURCE = "own:pub_00000000-0000-4000-8000-0000000000a1:post_00000000-0000-4000-8000-00000000a101";
const OTHER = "own:pub_00000000-0000-4000-8000-0000000000a1:post_00000000-0000-4000-8000-00000000a102";
let n = 100;
const newUid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

async function signedIn() {
  const uid = newUid();
  fakes.supabase.seedSession(uid, { accessToken: `at-${uid}`, refreshToken: fakes.auth.issueRefreshToken(), expiresAt: Date.now() + 3_600_000 });
  const publications = await checkKey(FAKE_KEY);
  fakes.supabase.connections.set(`${uid}:beehiiv`, { secret: FAKE_KEY, last4: "x", meta: { publications }, status: "active", leaseHeld: false });
  return uid;
}
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
async function call(handler: (req: never, ctx?: never) => Promise<Response>, method: string, path: string, uid: string | null, body?: unknown, o: { headers?: Record<string, string>; ctx?: unknown } = {}) {
  const req = makeRequest(`${ORIGIN}${path}`, { method, uid, body, headers: o.headers });
  const { value } = await inRequest(req, () => handler(req as never, o.ctx as never));
  return { status: value.status, json: (await value.json().catch(() => ({}))) as Json };
}
const put = (uid: string | null, body: Json, headers?: Record<string, string>) => call(runPut as never, "PUT", "/api/run", uid, { source: SOURCE, picks: [6, 3], template: "", step: 3, ...body }, { headers });
const patch = (uid: string | null, id: string, body: Json) => call(savedPatch as never, "PATCH", `/api/saved/${id}`, uid, { source: SOURCE, picks: [6, 3], template: "", step: 3, ...body }, { ctx: { params: Promise.resolve({ id }) } });
const savedOpen = (uid: string | null, id: string) => call(savedGet as never, "GET", `/api/saved/${id}`, uid, undefined, { ctx: { params: Promise.resolve({ id }) } });
const savedDel = (uid: string | null, id: string) => call(savedDelete as never, "DELETE", `/api/saved/${id}`, uid, undefined, { ctx: { params: Promise.resolve({ id }) } });
const createSaved = async (uid: string, body: Json = {}) => (await call(savedPost as never, "POST", "/api/saved", uid, { source: SOURCE, picks: [6, 3], template: "", step: 3, ...body })).json;
const wait = (ms = 5) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => fakes.reset());

describe("PUT /api/run: autosave from two devices", () => {
  test("not signed in: 401; from another site: 403; nothing is stored either way", async () => {
    const uid = await signedIn();
    assert.equal((await put(null, {})).status, 401);
    assert.equal((await put(uid, {}, { "sec-fetch-site": "cross-site" })).status, 403);
    assert.equal(await getRun(uid), null);
  });
  test("an issue that can't be kept (the sample, 'the newest'), or picks that aren't in it: refused, nothing stored", async () => {
    const uid = await signedIn();
    assert.ok([400, 404].includes((await put(uid, { source: "demo" })).status));
    assert.equal((await put(uid, { picks: [99999] })).status, 400);
    assert.equal((await put(uid, { picks: [] })).status, 400);
    assert.equal(await getRun(uid), null);
  });
  test("a first write is kept and answers the time the server gave it", async () => {
    const uid = await signedIn();
    const r = await put(uid, {});
    assert.equal(r.status, 200);
    assert.equal(typeof r.json.updatedAt, "string");
    assert.deepEqual((await getRun(uid))?.picks, [6, 3]);
  });
  test("the same device carries on: each write names the time of its last one and goes through", async () => {
    const uid = await signedIn();
    const a1 = await put(uid, {});
    await wait();
    const a2 = await put(uid, { picks: [6], ifUpdatedAt: a1.json.updatedAt });
    assert.equal(a2.status, 200);
    await wait();
    assert.equal((await put(uid, { picks: [6, 3], ifUpdatedAt: a2.json.updatedAt })).status, 200);
  });
  test("a second device that has never seen the run, with different picks: 409 that says when the saved run was written, and nothing changes", async () => {
    const uid = await signedIn();
    const a = await put(uid, { picks: [6, 3] });
    const b = await put(uid, { picks: [3] });
    assert.equal(b.status, 409);
    assert.equal(b.json.serverUpdatedAt, a.json.updatedAt);
    assert.deepEqual((await getRun(uid))?.picks, [6, 3]);
  });
  test("the first device then writes with a time that is out of date: 409, and the other device's work is kept", async () => {
    const uid = await signedIn();
    const a1 = await put(uid, {});
    await wait();
    const b = await put(uid, { picks: [3], ifUpdatedAt: a1.json.updatedAt }); // device B had loaded A's run, then changed it
    assert.equal(b.status, 200);
    await wait();
    const a2 = await put(uid, { picks: [6], ifUpdatedAt: a1.json.updatedAt }); // device A still holds the old time
    assert.equal(a2.status, 409);
    assert.equal(a2.json.serverUpdatedAt, b.json.updatedAt);
    assert.deepEqual((await getRun(uid))?.picks, [3]);
  });
  test("'Use this screen': force overwrites, and the answer carries the new time to write against", async () => {
    const uid = await signedIn();
    await put(uid, { picks: [6, 3] });
    const mine = await put(uid, { picks: [3], force: true });
    assert.equal(mine.status, 200);
    assert.deepEqual((await getRun(uid))?.picks, [3]);
    await wait();
    assert.equal((await put(uid, { picks: [3, 6], ifUpdatedAt: mine.json.updatedAt })).status, 200, "and from then on writes go through without force");
  });
  test("force has to be exactly true (a string or a 1 does not count)", async () => {
    const uid = await signedIn();
    await put(uid, { picks: [6, 3] });
    for (const force of ["true", 1, "yes"]) assert.equal((await put(uid, { picks: [3], force })).status, 409, String(force));
    assert.deepEqual((await getRun(uid))?.picks, [6, 3]);
  });
  test("a device with no memory (cleared storage) that holds exactly what is stored loses nothing, so no banner", async () => {
    const uid = await signedIn();
    await put(uid, { picks: [6, 3] });
    assert.equal((await put(uid, { picks: [6, 3] })).status, 200);
  });
  test("a different issue takes the slot without a question (the app asked about unsaved work already)", async () => {
    const uid = await signedIn();
    await put(uid, { source: SOURCE });
    const r = await put(uid, { source: OTHER });
    assert.equal(r.status, 200);
    assert.equal((await getRun(uid))?.source, OTHER);
  });
  test("two accounts never conflict with each other", async () => {
    const [u1, u2] = [await signedIn(), await signedIn()];
    await put(u1, { picks: [6, 3] });
    assert.equal((await put(u2, { picks: [3] })).status, 200);
    assert.deepEqual((await getRun(u1))?.picks, [6, 3]);
  });
});

describe("GET /api/run: 'Load the saved run'", () => {
  test("no run: status says so, and opening it is a 404 (the banner shows the error and keeps the screen)", async () => {
    const uid = await signedIn();
    const s = await call(runGet as never, "GET", "/api/run", uid);
    assert.deepEqual(s.json, { run: null, unsaved: false, hasSavedForIssue: false, unsavedHighlights: 0 });
    assert.equal((await call(runGet as never, "GET", "/api/run?open=1", uid)).status, 404);
  });
  test("highlights no saved creation holds are counted, with or without a run (a highlight nobody picked is in no run)", async () => {
    const uid = await signedIn();
    const a = await addCustomChunk(uid, "pub:post", "first", null);
    const b = await addCustomChunk(uid, "pub:post", "second", null);
    const count = async () => (await call(runGet as never, "GET", "/api/run", uid)).json.unsavedHighlights;
    assert.equal(await count(), 2);
    await saveCreation(uid, { source: SOURCE, link: "https://example.test/p", picks: [a!.id], template: "", format: null, step: 3, newsletter: "N", title: "T" });
    assert.equal(await count(), 1, "the one a saved creation holds is safe");
    assert.ok(b);
  });
  test("opening gives the other device's picks, step and the time to write against; not signed in is 401", async () => {
    const uid = await signedIn();
    const a = await put(uid, { picks: [6, 3], step: 4 });
    const o = await call(runGet as never, "GET", "/api/run?open=1", uid);
    assert.equal(o.status, 200);
    assert.deepEqual(o.json.creation.picks, [6, 3]);
    assert.equal(o.json.creation.step, 4);
    assert.equal(o.json.creation.updatedAt, a.json.updatedAt, "the page keeps this as ifUpdatedAt, so its next write goes through");
    assert.equal((await call(runGet as never, "GET", "/api/run?open=1", null)).status, 401);
  });
  test("picks the issue no longer has are left out, and the caption is dropped with them", async () => {
    const uid = await signedIn();
    await put(uid, { picks: [6, 3] });
    fakes.supabase.rows("current_runs")[0].picks = [6, 3, 99999];
    const o = await call(runGet as never, "GET", "/api/run?open=1", uid);
    assert.deepEqual(o.json.creation.picks, [6, 3]);
    assert.equal(o.json.creation.dropped, 1);
    assert.equal(o.json.creation.format, null);
  });
  test("an account cannot open another's run", async () => {
    const [u1, u2] = [await signedIn(), await signedIn()];
    await put(u1, {});
    assert.equal((await call(runGet as never, "GET", "/api/run?open=1", u2)).status, 404);
  });
});

describe("DELETE /api/run and POST /api/run/save", () => {
  test("discard removes the run; from another site it is refused and the run stays", async () => {
    const uid = await signedIn();
    await put(uid, {});
    assert.equal((await call(runDelete as never, "DELETE", "/api/run", uid, undefined, { headers: { "sec-fetch-site": "cross-site" } })).status, 403);
    assert.ok(await getRun(uid));
    assert.equal((await call(runDelete as never, "DELETE", "/api/run", uid)).status, 200);
    assert.equal(await getRun(uid), null);
  });
  test("a device that writes after another discarded the run starts a fresh one (no banner: nothing there to disagree with)", async () => {
    const uid = await signedIn();
    const a = await put(uid, {});
    await call(runDelete as never, "DELETE", "/api/run", uid);
    assert.equal((await put(uid, { ifUpdatedAt: a.json.updatedAt })).status, 200);
  });
  test("'Save it first': no run is a 404, a run becomes the saved creation for its issue, signed out is 401", async () => {
    const uid = await signedIn();
    assert.equal((await call(runSave as never, "POST", "/api/run/save", uid)).status, 404);
    await put(uid, { picks: [6, 3] });
    assert.equal((await call(runSave as never, "POST", "/api/run/save", uid)).status, 200);
    assert.equal(fakes.supabase.rows("saved_creations").length, 1);
    assert.equal((await call(runSave as never, "POST", "/api/run/save", null)).status, 401);
  });
});

describe("saved creations: PATCH (the 'saved creation doesn't match' and 'deleted' banners)", () => {
  test("saving gives an id and a time; the same issue again replaces it instead of adding another", async () => {
    const uid = await signedIn();
    const s1 = await createSaved(uid);
    assert.equal(typeof s1.id, "string");
    const s2 = await createSaved(uid, { picks: [3] });
    assert.equal(s2.id, s1.id);
    assert.equal(fakes.supabase.rows("saved_creations").length, 1);
  });
  test("a patch that names the time of the last write goes through; an out-of-date one is a 409 with the server's time, and nothing changes", async () => {
    const uid = await signedIn();
    const s = await createSaved(uid);
    await wait();
    const p1 = await patch(uid, s.id, { picks: [6], ifUpdatedAt: s.updatedAt });
    assert.equal(p1.status, 200);
    await wait();
    const stale = await patch(uid, s.id, { picks: [3], ifUpdatedAt: s.updatedAt });
    assert.equal(stale.status, 409);
    assert.equal(stale.json.serverUpdatedAt, p1.json.updatedAt);
    assert.deepEqual((await getCreation(uid, s.id))?.picks, [6]);
  });
  test("no time at all (a device that never loaded it) is a 409 too, and 'Use this screen' (force) overwrites", async () => {
    const uid = await signedIn();
    const s = await createSaved(uid);
    assert.equal((await patch(uid, s.id, { picks: [3] })).status, 409);
    const f = await patch(uid, s.id, { picks: [3], force: true });
    assert.equal(f.status, 200);
    assert.deepEqual((await getCreation(uid, s.id))?.picks, [3]);
    await wait();
    assert.equal((await patch(uid, s.id, { picks: [3, 6], ifUpdatedAt: f.json.updatedAt })).status, 200);
  });
  test("a deleted creation answers 404 and stays deleted, even with force (the 'was deleted' notice, never a silent re-create)", async () => {
    const uid = await signedIn();
    const s = await createSaved(uid);
    assert.equal((await savedDel(uid, s.id)).status, 200);
    assert.equal((await patch(uid, s.id, { ifUpdatedAt: s.updatedAt })).status, 404);
    assert.equal((await patch(uid, s.id, { force: true })).status, 404);
    assert.equal(fakes.supabase.rows("saved_creations").length, 0);
  });
  test("another account gets a 404 for it, in every method, and changes nothing", async () => {
    const [u1, u2] = [await signedIn(), await signedIn()];
    const s = await createSaved(u1);
    assert.equal((await patch(u2, s.id, { force: true, picks: [3] })).status, 404);
    assert.equal((await savedOpen(u2, s.id)).status, 404);
    await savedDel(u2, s.id);
    assert.deepEqual((await getCreation(u1, s.id))?.picks, [6, 3]);
  });
  test("an id that isn't one, signed out, and a request from another site", async () => {
    const uid = await signedIn();
    const s = await createSaved(uid);
    assert.equal((await patch(uid, "nope", {})).status, 404);
    assert.equal((await savedOpen(uid, "../../x")).status, 404);
    assert.equal((await patch(null, s.id, {})).status, 401);
    const req = makeRequest(`${ORIGIN}/api/saved/${s.id}`, { method: "PATCH", uid, body: { source: SOURCE, picks: [3], force: true }, headers: { "sec-fetch-site": "cross-site" } });
    const { value } = await inRequest(req, () => savedPatch(req, { params: Promise.resolve({ id: s.id }) }));
    assert.equal(value.status, 403);
    assert.deepEqual((await getCreation(uid, s.id))?.picks, [6, 3]);
  });
  test("'Load the saved creation' opens it with its picks; a creation whose picks are all gone is a 409 with a message", async () => {
    const uid = await signedIn();
    const s = await createSaved(uid);
    const o = await savedOpen(uid, s.id);
    assert.equal(o.status, 200);
    assert.deepEqual(o.json.creation.picks, [6, 3]);
    fakes.supabase.rows("saved_creations")[0].picks = [99999];
    const gone = await savedOpen(uid, s.id);
    assert.equal(gone.status, 409);
    assert.match(gone.json.error, /picks/i);
  });
});
