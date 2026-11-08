import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { fakes } from "../../test/setup"; // first: sets the env and the fake network
import { jsonResponse } from "../../test/fakes";
import { inRequest, makeRequest } from "../../test/request";
import { requireSession } from "../../lib/guard";
import { checkKey } from "../../lib/beehiiv";
import { FAKE_KEY } from "../../lib/fakeBeehiiv";
import { putRun, getRun } from "../../lib/currentRun";
import { HINT_COOKIE, PKCE_COOKIE, SESSION_COOKIE, readUid, seal, unseal } from "../../lib/session";
import { POST as draft } from "./draft/route";
import { POST as historyRefresh } from "./history/refresh/route";
import { POST as historyRetry } from "./history/retry/route";
import { GET as postStatus } from "./post-status/route";
import { GET as authLogin } from "./auth/buffer/login/route";
import { GET as authCallback } from "./auth/buffer/callback/route";
import { GET as authRefresh } from "./auth/buffer/refresh/route";
import { GET as authLogout } from "./auth/buffer/logout/route";

// What a request to each route that touches Buffer or the Buffer session is allowed to do. The rules:
//   - no session, or an expired Buffer grant, is a 401 and nothing else happens; a Buffer outage is a 503, never a logout;
//   - nothing is queued unless the request is complete, and "publish now" only with an explicit yes;
//   - a send only ever touches the signed-in account's own rows;
//   - a login can only come back to a path on this site.

const ORIGIN = "https://pollen.test"; // BUFFER_REDIRECT_URI's origin (see the test setup)
const SOURCE = "own:pub_00000000-0000-4000-8000-0000000000a1:post_00000000-0000-4000-8000-00000000a101";
const OTHER_SOURCE = "own:pub_00000000-0000-4000-8000-0000000000a1:post_00000000-0000-4000-8000-00000000a102";
let n = 0;
const newUid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`; // the session cache lives per user for the process

/** A signed-in account with a working Buffer session and its beehiiv key (so a real issue can be loaded). */
async function signedIn() {
  const uid = newUid();
  fakes.supabase.seedSession(uid, { accessToken: `at-${uid}`, refreshToken: fakes.auth.issueRefreshToken(), expiresAt: Date.now() + 3_600_000 });
  const publications = await checkKey(FAKE_KEY);
  fakes.supabase.connections.set(`${uid}:beehiiv`, { secret: FAKE_KEY, last4: "x", meta: { publications }, status: "active", leaseHeld: false });
  return uid;
}
const rows = () => fakes.supabase.rows("post_history");

beforeEach(() => {
  fakes.reset();
  process.env.PUBLIC_BASE_URL = "https://pp.example.com";
});

describe("requireSession (the guard in front of every Buffer route)", () => {
  const call = (uid: string | null, cookies?: Record<string, string>) => requireSession(makeRequest(`${ORIGIN}/x`, { uid, cookies }));

  test("no cookie: 401", async () => {
    const r = await call(null);
    assert.ok("response" in r);
    assert.equal(r.response.status, 401);
  });
  test("a cookie that is not ours (garbage, or sealed with another key): 401", async () => {
    for (const v of ["garbage", "a.b.c", seal({ notUid: 1 })]) {
      const r = await call(null, { [SESSION_COOKIE]: v });
      assert.ok("response" in r && r.response.status === 401, v);
    }
  });
  test("a good cookie but no Buffer connection: 401 'log in again'", async () => {
    const r = await call(newUid());
    assert.ok("response" in r);
    assert.equal(r.response.status, 401);
    assert.match(((await r.response.json()) as { error: string }).error, /log in again/i);
  });
  test("a working session: the token and the user id", async () => {
    const uid = await signedIn();
    const r = await call(uid);
    assert.ok("session" in r);
    assert.equal(r.session.userId, uid);
    assert.equal(r.session.accessToken, `at-${uid}`);
  });
  test("an expired token is refreshed on the way in", async () => {
    const uid = newUid();
    fakes.supabase.seedSession(uid, { accessToken: "old", refreshToken: fakes.auth.issueRefreshToken(), expiresAt: Date.now() - 1000 });
    const r = await call(uid);
    assert.ok("session" in r);
    assert.notEqual(r.session.accessToken, "old");
  });
  test("a revoked grant: 401 (log in again), not a 503", async () => {
    const uid = newUid();
    fakes.supabase.seedSession(uid, { accessToken: "old", refreshToken: "rt-never-issued", expiresAt: Date.now() - 1000 });
    const r = await call(uid);
    assert.ok("response" in r);
    assert.equal(r.response.status, 401);
  });
  test("Buffer being down while refreshing: 503, the person is not logged out", async () => {
    const uid = newUid();
    fakes.supabase.seedSession(uid, { accessToken: "old", refreshToken: fakes.auth.issueRefreshToken(), expiresAt: Date.now() - 1000 });
    fakes.auth.force = { status: 503, body: "down" };
    const r = await call(uid);
    assert.ok("response" in r);
    assert.equal(r.response.status, 503);
    assert.ok(fakes.supabase.storedSession(uid), "the saved session is still there");
  });
});

describe("POST /api/draft (queue a send)", () => {
  const channel = (over = {}) => ({ id: "c1", service: "instagram", name: "IG", ...over });
  const good = (over: Record<string, unknown> = {}) => ({ source: SOURCE, channels: [channel()], picks: [6, 3], caption: "hello", intent: "draft", ...over });
  async function send(body: unknown, uid: string | null) {
    const req = makeRequest(`${ORIGIN}/api/draft`, { uid, body });
    const { value, afterTasks } = await inRequest(req, () => draft(req));
    return { res: value, json: (await value.json()) as Record<string, unknown>, afterTasks };
  }

  test("not signed in: 401, nothing queued", async () => {
    const r = await send(good(), null);
    assert.equal(r.res.status, 401);
    assert.equal(rows().length, 0);
  });
  test("publish now without the confirmation flag: 400, nothing queued (a stray request cannot publish)", async () => {
    const uid = await signedIn();
    for (const confirmed of [undefined, false, "true", 1]) {
      const r = await send(good({ intent: "now", confirmed }), uid);
      assert.equal(r.res.status, 400, String(confirmed));
    }
    assert.equal(rows().length, 0);
  });
  test("no source, or the sample issue: 403 'can't be sent', nothing queued", async () => {
    const uid = await signedIn();
    for (const source of [undefined, "demo", "", "own:"]) {
      const r = await send(good({ source }), uid);
      assert.equal(r.res.status, 403, String(source));
    }
    assert.equal(rows().length, 0);
  });
  test("a request that is not complete: 400 each, nothing queued", async () => {
    const uid = await signedIn();
    assert.equal((await send(good({ channels: [] }), uid)).res.status, 400);
    assert.equal((await send(good({ channels: [{ service: "instagram" }, null, { id: "", service: "x" }, { id: "c", service: 5 }] }), uid)).res.status, 400, "channels without an id or a text service do not count");
    assert.equal((await send(good({ channels: Array.from({ length: 201 }, (_, i) => channel({ id: `c${i}` })) }), uid)).res.status, 400);
    assert.equal((await send(good({ picks: [] }), uid)).res.status, 400);
    assert.equal((await send(good({ picks: ["a", null, NaN] }), uid)).res.status, 400);
    assert.equal(rows().length, 0);
  });
  test("slide images that Buffer cannot reach (localhost): 400, nothing queued", async () => {
    const uid = await signedIn();
    process.env.PUBLIC_BASE_URL = "http://localhost:3000";
    const r = await send(good(), uid);
    assert.equal(r.res.status, 400);
    assert.match(String(r.json.error), /can't reach/);
    assert.equal(rows().length, 0);
  });
  test("a draft: one queued row per channel, then the queue is started after the response", async () => {
    const uid = await signedIn();
    const r = await send(good({ channels: [channel({ id: "c1" }), channel({ id: "c2", service: "linkedin", name: "LI" })] }), uid);
    assert.equal(r.res.status, 200);
    assert.equal(r.json.ok, true);
    assert.equal(rows().length, 2);
    assert.ok(rows().every((x) => x.status === "queued" && x.user_id === uid && x.batch_id === r.json.batchId && x.mode === "draft"));
    assert.deepEqual(rows().map((x) => x.channel_id).sort(), ["c1", "c2"]);
    assert.equal(r.afterTasks.length, 1, "processing is handed to after(), not done in the request");
  });
  test("each channel gets its own caption, falling back to the shared one", async () => {
    const uid = await signedIn();
    await send(good({ caption: "shared", captions: { c2: "just for LinkedIn" }, channels: [channel({ id: "c1" }), channel({ id: "c2", service: "linkedin" })] }), uid);
    const by = Object.fromEntries(rows().map((x) => [x.channel_id as string, x.caption]));
    assert.equal(by.c1, "shared");
    assert.equal(by.c2, "just for LinkedIn");
  });
  test("publish now with the yes: queued as 'now'", async () => {
    const uid = await signedIn();
    const r = await send(good({ intent: "now", confirmed: true }), uid);
    assert.equal(r.res.status, 200);
    assert.ok(rows().every((x) => x.mode === "now"));
  });
  test("a caption over its network's limit is saved as a draft even on publish-now, and the others go as asked", async () => {
    const uid = await signedIn();
    await send(good({ intent: "now", confirmed: true, caption: "short", captions: { "c-long": "x".repeat(5000) }, channels: [channel({ id: "c-ok" }), channel({ id: "c-long" })] }), uid);
    const by = Object.fromEntries(rows().map((x) => [x.channel_id as string, x.mode]));
    assert.equal(by["c-ok"], "now");
    assert.equal(by["c-long"], "draft");
  });
  test("a sent run is discarded on the server, but only the run of that issue, and only this account's", async () => {
    const uid = await signedIn();
    const other = newUid();
    const input = (source: string) => ({ source, link: "l", picks: [1], template: "", format: null, step: 3 as const, newsletter: "N", title: "T" });
    await putRun(uid, input(SOURCE), { ifUpdatedAt: null, force: true, savedId: null });
    await putRun(other, input(SOURCE), { ifUpdatedAt: null, force: true, savedId: null });
    await send(good(), uid);
    assert.equal(await getRun(uid), null);
    assert.ok(await getRun(other), "another account's run is untouched");
  });
  test("a run of ANOTHER issue is not discarded by sending this one", async () => {
    const uid = await signedIn();
    await putRun(uid, { source: OTHER_SOURCE, link: "l", picks: [1], template: "", format: null, step: 3, newsletter: "N", title: "T" }, { ifUpdatedAt: null, force: true, savedId: null });
    await send(good(), uid);
    assert.ok(await getRun(uid));
  });
  test("a database failure: 503 'Nothing was sent', the run is kept, nothing is handed to the queue", async () => {
    const uid = await signedIn();
    await putRun(uid, { source: SOURCE, link: "l", picks: [1], template: "", format: null, step: 3, newsletter: "N", title: "T" }, { ifUpdatedAt: null, force: true, savedId: null });
    fakes.supabase.failTable["post_history"] = { status: 500, message: "boom" };
    const r = await send(good(), uid);
    assert.equal(r.res.status, 503);
    assert.match(String(r.json.error), /Nothing was sent/);
    assert.ok(await getRun(uid), "so the person can try again");
    assert.equal(r.afterTasks.length, 0);
  });
});

describe("POST /api/history/retry", () => {
  const failed = (uid: string, over: Record<string, unknown> = {}) => {
    const id = rows().length + 1;
    rows().push({ id, user_id: uid, status: "failed", mode: "draft", caption: "c", service: "instagram", created_at: new Date().toISOString(), attempts: 0, ...over });
    return id;
  };
  async function retry(body: unknown, uid: string | null) {
    const req = makeRequest(`${ORIGIN}/api/history/retry`, { uid, body });
    const { value, afterTasks } = await inRequest(req, () => historyRetry(req));
    return { res: value, json: (await value.json()) as Record<string, unknown>, afterTasks };
  }
  test("not signed in: 401", async () => {
    assert.equal((await retry({ ids: [1] }, null)).res.status, 401);
  });
  test("nothing usable to retry: 400", async () => {
    const uid = await signedIn();
    for (const ids of [undefined, [], ["1"], [0, -3, 1.5], "1"]) assert.equal((await retry({ ids }, uid)).res.status, 400, JSON.stringify(ids));
  });
  test("a failed draft goes back in the queue and the queue is started", async () => {
    const uid = await signedIn();
    const id = failed(uid);
    const r = await retry({ ids: [id] }, uid);
    assert.equal(r.res.status, 200);
    assert.equal(r.json.requeued, 1);
    assert.equal(rows()[0].status, "queued");
    assert.equal(r.afterTasks.length, 1);
  });
  test("nothing went back: no needless queue run", async () => {
    const uid = await signedIn();
    const id = failed(uid, { status: "sent" });
    const r = await retry({ ids: [id] }, uid);
    assert.equal(r.json.requeued, 0);
    assert.equal(r.afterTasks.length, 0);
  });
  test("a failed publish-now: 409 and nothing changes without the yes; with it, it goes back", async () => {
    const uid = await signedIn();
    const id = failed(uid, { mode: "now" });
    const no = await retry({ ids: [id] }, uid);
    assert.equal(no.res.status, 409);
    assert.equal(no.json.needsConfirm, 1);
    assert.equal(rows()[0].status, "failed");
    assert.equal(no.afterTasks.length, 0);
    const yes = await retry({ ids: [id], confirmed: true }, uid);
    assert.equal(yes.json.requeued, 1);
  });
  test("'confirmed' must be exactly true", async () => {
    const uid = await signedIn();
    const id = failed(uid, { mode: "now" });
    assert.equal((await retry({ ids: [id], confirmed: "true" }, uid)).res.status, 409);
    assert.equal((await retry({ ids: [id], confirmed: 1 }, uid)).res.status, 409);
  });
  test("unknown entries: ignored by a plain retry; with sendAgain they need the yes", async () => {
    const uid = await signedIn();
    const id = failed(uid, { status: "unknown" });
    assert.equal((await retry({ ids: [id], confirmed: true }, uid)).json.requeued, 0);
    assert.equal((await retry({ ids: [id], sendAgain: true }, uid)).res.status, 409);
    assert.equal((await retry({ ids: [id], sendAgain: true, confirmed: true }, uid)).json.requeued, 1);
  });
  test("another account's entries are never touched", async () => {
    const uid = await signedIn();
    const id = failed(newUid());
    const r = await retry({ ids: [id], confirmed: true, sendAgain: true }, uid);
    assert.equal(r.json.requeued, 0);
    assert.equal(rows()[0].status, "failed");
  });
  test("at most 50 ids are considered", async () => {
    const uid = await signedIn();
    const ids = Array.from({ length: 60 }, () => failed(uid));
    const r = await retry({ ids }, uid);
    assert.equal(r.json.requeued, 50);
  });
  test("a database failure: 503, never a silent 'nothing to retry'", async () => {
    const uid = await signedIn();
    const id = failed(uid);
    fakes.supabase.failTable["post_history"] = { status: 500, message: "boom" };
    const r = await retry({ ids: [id] }, uid);
    assert.equal(r.res.status, 503);
  });
});

describe("POST /api/history/refresh", () => {
  async function refresh(qs: string, uid: string | null) {
    const req = makeRequest(`${ORIGIN}/api/history/refresh${qs}`, { uid, method: "POST" });
    const { value } = await inRequest(req, () => historyRefresh(req));
    return { res: value, json: (await value.json()) as { history?: { id: number; status: string }[]; error?: string } };
  }
  test("not signed in: 401", async () => {
    assert.equal((await refresh("", null)).res.status, 401);
  });
  test("a batch that is not an id: 400", async () => {
    const uid = await signedIn();
    for (const b of ["x", "1", "'; drop table", "00000000-0000-0000-0000-00000000000"]) assert.equal((await refresh(`?batch=${encodeURIComponent(b)}`, uid)).res.status, 400, b);
  });
  test("returns this account's history only, uncached", async () => {
    const uid = await signedIn();
    rows().push({ id: 1, user_id: uid, status: "sent", mode: "draft", service: "instagram", created_at: new Date().toISOString() });
    rows().push({ id: 2, user_id: newUid(), status: "sent", mode: "draft", service: "instagram", created_at: new Date().toISOString() });
    const r = await refresh("", uid);
    assert.equal(r.res.status, 200);
    assert.deepEqual(r.json.history!.map((h) => h.id), [1]);
    assert.equal(r.res.headers.get("cache-control"), "no-store");
  });
  test("one send: only its entries; the History filters narrow it", async () => {
    const uid = await signedIn();
    const b = "11111111-1111-4111-8111-111111111111";
    rows().push({ id: 1, user_id: uid, status: "sent", mode: "draft", service: "instagram", batch_id: b, created_at: new Date().toISOString() });
    rows().push({ id: 2, user_id: uid, status: "sent", mode: "draft", service: "linkedin", batch_id: b, created_at: new Date().toISOString() });
    rows().push({ id: 3, user_id: uid, status: "sent", mode: "draft", service: "instagram", batch_id: null, created_at: new Date().toISOString() });
    assert.deepEqual((await refresh(`?batch=${b}`, uid)).json.history!.map((h) => h.id).sort(), [1, 2]);
    assert.deepEqual((await refresh(`?service=linkedin`, uid)).json.history!.map((h) => h.id), [2]);
  });
  test("asks Buffer with the person's own token about posts still going out, and records the answer", async () => {
    const uid = await signedIn();
    rows().push({ id: 1, user_id: uid, status: "sending", mode: "now", post_id: "bp-1", service: "instagram", created_at: new Date().toISOString() });
    fakes.graphql = () => jsonResponse({ data: { p0: { id: "bp-1", status: "sent", sentAt: null, externalLink: "https://x.test/p" } } });
    const r = await refresh("", uid);
    assert.equal(r.json.history![0].status, "sent");
    assert.equal(fakes.graphqlCalls[0].token, `at-${uid}`);
  });
  test("a database failure: 503 with a message, not a crash", async () => {
    const uid = await signedIn();
    fakes.supabase.failTable["post_history"] = { status: 500, message: "boom" };
    const r = await refresh("", uid);
    assert.equal(r.res.status, 503);
    assert.match(r.json.error!, /Try again/);
  });
});

describe("GET /api/post-status", () => {
  const ask = (qs: string, uid: string | null) => postStatus(makeRequest(`${ORIGIN}/api/post-status${qs}`, { uid }));
  const answerFor = (map: Record<string, unknown>) => {
    fakes.graphql = (query) => {
      const data: Record<string, unknown> = {};
      for (const m of query.matchAll(/(p\d+): post\(input: \{ id: "([^"]+)" \}\)/g)) data[m[1]] = map[m[2]] ?? null;
      return jsonResponse({ data });
    };
  };
  test("not signed in: 401, and Buffer is never asked", async () => {
    assert.equal((await ask("?ids=a", null)).status, 401);
    assert.equal(fakes.graphqlCalls.length, 0);
  });
  test("no ids: 400", async () => {
    const uid = await signedIn();
    for (const qs of ["", "?ids=", "?ids=,, ,"]) assert.equal((await ask(qs, uid)).status, 400, qs);
  });
  test("the state of each post, in the order asked, using the person's own token", async () => {
    const uid = await signedIn();
    answerFor({ a: { id: "a", status: "sent", sentAt: null, externalLink: "https://x.test/a" }, b: { id: "b", status: "sending" } });
    const res = await ask("?ids=a, b ,c", uid);
    const j = (await res.json()) as { results: { id: string; status?: string; externalLink?: string; error?: string }[] };
    assert.deepEqual(j.results.map((r) => r.id), ["a", "b", "c"]);
    assert.equal(j.results[0].status, "sent");
    assert.equal(j.results[0].externalLink, "https://x.test/a");
    assert.equal(j.results[1].status, "sending");
    assert.ok(j.results[2].error, "a post Buffer does not know is reported, not dropped");
    assert.equal(fakes.graphqlCalls[0].token, `at-${uid}`);
    assert.equal(res.headers.get("cache-control"), "no-store");
  });
  test("at most 50 ids", async () => {
    const uid = await signedIn();
    answerFor({});
    const ids = Array.from({ length: 80 }, (_, i) => `p${i}`).join(",");
    const j = (await (await ask(`?ids=${ids}`, uid)).json()) as { results: unknown[] };
    assert.equal(j.results.length, 50);
  });
  test("a Buffer outage is reported per post, not as a crash", async () => {
    const uid = await signedIn();
    fakes.graphql = () => new Response("down", { status: 500 });
    const res = await ask("?ids=a,b", uid);
    assert.equal(res.status, 200);
    const j = (await res.json()) as { results: { error?: string }[] };
    assert.ok(j.results.every((r) => r.error));
  });
});

describe("Buffer login: /api/auth/buffer/login", () => {
  const location = (r: Response) => new URL(r.headers.get("location")!);
  test("without continue=1 it always shows the intro page first", async () => {
    const r = await authLogin(makeRequest(`${ORIGIN}/api/auth/buffer/login`));
    assert.equal(location(r).pathname, "/login");
  });
  test("the intro keeps where the person was going", async () => {
    const r = await authLogin(makeRequest(`${ORIGIN}/api/auth/buffer/login?next=/history?status=failed`));
    assert.equal(location(r).pathname, "/login");
    assert.equal(location(r).searchParams.get("next"), "/history?status=failed");
  });
  test("a next that leaves the site is dropped", async () => {
    for (const next of ["https://evil.test", "//evil.test", "evil", "javascript:alert(1)"]) {
      const r = await authLogin(makeRequest(`${ORIGIN}/api/auth/buffer/login?next=${encodeURIComponent(next)}`));
      assert.equal(location(r).pathname, "/login", next);
      assert.equal(location(r).searchParams.get("next"), null, next);
    }
  });
  test("with continue=1 it goes to Buffer with PKCE, and remembers the secret in a sealed, short-lived cookie", async () => {
    const r = await authLogin(makeRequest(`${ORIGIN}/api/auth/buffer/login?continue=1&next=/source`));
    const to = location(r);
    assert.equal(to.searchParams.get("response_type"), "code");
    assert.equal(to.searchParams.get("client_id"), "client-123");
    assert.equal(to.searchParams.get("code_challenge_method"), "S256");
    assert.ok(to.searchParams.get("code_challenge"));
    const cookie = r.cookies.get(PKCE_COOKIE)!;
    const pkce = unseal<{ verifier: string; state: string; next?: string }>(cookie.value)!;
    assert.equal(pkce.state, to.searchParams.get("state"));
    assert.equal(pkce.next, "/source");
    assert.ok(!r.headers.get("location")!.includes(pkce.verifier), "the verifier never travels in the address");
  });
  test("every login gets its own state and verifier", async () => {
    const a = unseal<{ verifier: string; state: string }>((await authLogin(makeRequest(`${ORIGIN}/api/auth/buffer/login?continue=1`))).cookies.get(PKCE_COOKIE)!.value)!;
    const b = unseal<{ verifier: string; state: string }>((await authLogin(makeRequest(`${ORIGIN}/api/auth/buffer/login?continue=1`))).cookies.get(PKCE_COOKIE)!.value)!;
    assert.notEqual(a.state, b.state);
    assert.notEqual(a.verifier, b.verifier);
  });
});

describe("Buffer login: /api/auth/buffer/callback", () => {
  const pkce = (over: Record<string, unknown> = {}) => ({ verifier: "v-1", state: "s-1", next: "/source", ...over });
  const cb = (qs: string, cookie?: unknown) => authCallback(makeRequest(`${ORIGIN}/api/auth/buffer/callback?${qs}`, { cookies: cookie === undefined ? {} : { [PKCE_COOKIE]: seal(cookie) } }));
  const goodAccount = (id = "buf-1", email: string | null = "a@b.test") => {
    fakes.graphql = () => jsonResponse({ data: { account: { id, email } } });
  };
  const location = (r: Response) => new URL(r.headers.get("location")!);

  test("Buffer says no (the person declined): 400 with Buffer's reason, no login", async () => {
    const r = await cb("error=access_denied&error_description=nope", pkce());
    assert.equal(r.status, 400);
    assert.equal(((await r.json()) as { error: string }).error, "access_denied");
    assert.equal(r.cookies.get(SESSION_COOKIE), undefined);
  });
  test("no PKCE cookie, no code, or a different state: 400 'Invalid OAuth state', no login, Buffer not contacted", async () => {
    for (const r of [await cb("code=c&state=s-1"), await cb("state=s-1", pkce()), await cb("code=c&state=other", pkce()), await cb("code=c", pkce()), await authCallback(makeRequest(`${ORIGIN}/api/auth/buffer/callback?code=c&state=s-1`, { cookies: { [PKCE_COOKIE]: "garbage" } }))]) {
      assert.equal(r.status, 400);
      assert.equal(r.cookies.get(SESSION_COOKIE), undefined);
    }
    assert.equal(fakes.auth.requests.length, 0);
  });
  test("the happy path: user created, Buffer session saved, cookies set, back to where they were going", async () => {
    fakes.auth.addCode("code-1", "v-1");
    goodAccount();
    const r = await cb("code=code-1&state=s-1", pkce({ next: "/history" }));
    assert.equal(r.status, 307);
    assert.equal(location(r).pathname, "/history");
    const uid = readUid(r.cookies.get(SESSION_COOKIE)!.value)!;
    assert.ok(uid);
    assert.equal(r.cookies.get(HINT_COOKIE)!.value, "1");
    assert.equal(r.cookies.get(PKCE_COOKIE)?.value ?? "", "", "the one-time login secret is deleted");
    assert.ok(fakes.supabase.storedSession(uid)?.accessToken, "the tokens are in the database, not in a cookie");
    assert.equal(fakes.auth.requests[0].params.get("code_verifier"), "v-1");
  });
  test("with no next it goes to the first step", async () => {
    fakes.auth.addCode("code-1", "v-1");
    goodAccount();
    assert.equal(location(await cb("code=code-1&state=s-1", pkce({ next: undefined }))).pathname, "/source");
  });
  test("a next that leaves the site is ignored even if it got into the cookie", async () => {
    for (const next of ["https://evil.test/x", "//evil.test"]) {
      fakes.auth.addCode("code-1", "v-1");
      goodAccount();
      const r = await cb("code=code-1&state=s-1", pkce({ next }));
      assert.equal(location(r).origin, ORIGIN, next);
      assert.equal(location(r).pathname, "/source", next);
    }
  });
  test("the same Buffer account is the same user next time", async () => {
    goodAccount("buf-same");
    fakes.auth.addCode("c1", "v-1");
    const a = readUid((await cb("code=c1&state=s-1", pkce())).cookies.get(SESSION_COOKIE)!.value);
    fakes.auth.addCode("c2", "v-1");
    const b = readUid((await cb("code=c2&state=s-1", pkce())).cookies.get(SESSION_COOKIE)!.value);
    assert.equal(a, b);
    assert.equal(fakes.supabase.users.size, 1);
  });
  test("a different Buffer account is a different user", async () => {
    fakes.auth.addCode("c1", "v-1");
    goodAccount("buf-1");
    const a = readUid((await cb("code=c1&state=s-1", pkce())).cookies.get(SESSION_COOKIE)!.value);
    fakes.auth.addCode("c2", "v-1");
    goodAccount("buf-2");
    const b = readUid((await cb("code=c2&state=s-1", pkce())).cookies.get(SESSION_COOKIE)!.value);
    assert.notEqual(a, b);
  });
  test("a wrong code or verifier: 502, no login", async () => {
    fakes.auth.addCode("code-1", "another-verifier");
    goodAccount();
    const r = await cb("code=code-1&state=s-1", pkce());
    assert.equal(r.status, 502);
    assert.equal(r.cookies.get(SESSION_COOKIE), undefined);
  });
  test("Buffer's account lookup failing: 502, no login, nothing saved", async () => {
    fakes.auth.addCode("code-1", "v-1");
    fakes.graphql = () => jsonResponse({ errors: [{ message: "nope" }] }, 500);
    const r = await cb("code=code-1&state=s-1", pkce());
    assert.equal(r.status, 502);
    assert.equal(r.cookies.get(SESSION_COOKIE), undefined);
    assert.equal(fakes.supabase.users.size, 0);
  });
  test("an account answer with no id: 502, no login", async () => {
    fakes.auth.addCode("code-1", "v-1");
    fakes.graphql = () => jsonResponse({ data: { account: {} } });
    assert.equal((await cb("code=code-1&state=s-1", pkce())).status, 502);
  });
  test("a code can be used once", async () => {
    fakes.auth.addCode("code-1", "v-1");
    goodAccount();
    assert.equal((await cb("code=code-1&state=s-1", pkce())).status, 307);
    assert.equal((await cb("code=code-1&state=s-1", pkce())).status, 502);
  });
});

describe("/api/auth/buffer/refresh and /logout", () => {
  const location = (r: Response) => new URL(r.headers.get("location")!);
  test("refresh with no session: to the login page, remembering where the person was going", async () => {
    const r = await authRefresh(makeRequest(`${ORIGIN}/api/auth/buffer/refresh?next=/history`));
    assert.equal(location(r).pathname, "/login");
    assert.equal(location(r).searchParams.get("next"), "/history");
  });
  test("refresh forces ONE refresh, and goes back", async () => {
    const uid = await signedIn(); // token still valid by the clock
    const before = fakes.auth.requests.length;
    const r = await authRefresh(makeRequest(`${ORIGIN}/api/auth/buffer/refresh?next=/history`, { uid }));
    assert.equal(location(r).pathname, "/history");
    assert.equal(fakes.auth.requests.length - before, 1);
    assert.notEqual(fakes.supabase.storedSession(uid)!.accessToken, `at-${uid}`);
  });
  test("refresh never sends the person off the site", async () => {
    const uid = await signedIn();
    for (const next of ["https://evil.test", "//evil.test", "evil"]) {
      const r = await authRefresh(makeRequest(`${ORIGIN}/api/auth/buffer/refresh?next=${encodeURIComponent(next)}`, { uid }));
      assert.equal(location(r).origin, ORIGIN, next);
      assert.equal(location(r).pathname, "/source", next);
    }
  });
  test("refresh with a revoked grant, or while Buffer is down: to the login page, not an error page", async () => {
    const uid = newUid();
    fakes.supabase.seedSession(uid, { accessToken: "a", refreshToken: "rt-never-issued", expiresAt: Date.now() + 3_600_000 });
    assert.equal(location(await authRefresh(makeRequest(`${ORIGIN}/api/auth/buffer/refresh`, { uid }))).pathname, "/login");
    const uid2 = await signedIn();
    fakes.auth.force = { status: 503, body: "down" };
    assert.equal(location(await authRefresh(makeRequest(`${ORIGIN}/api/auth/buffer/refresh`, { uid: uid2 }))).pathname, "/login");
  });
  test("logout deletes the session cookies and goes home", async () => {
    const uid = await signedIn();
    const r = await authLogout(makeRequest(`${ORIGIN}/api/auth/buffer/logout`, { uid }));
    assert.equal(location(r).pathname, "/");
    for (const name of [SESSION_COOKIE, HINT_COOKIE, "b2b_session"]) {
      const c = r.cookies.get(name);
      assert.ok(!c || c.value === "", name);
    }
    assert.match(r.headers.get("set-cookie") ?? "", /pp_session=;/);
  });
});
