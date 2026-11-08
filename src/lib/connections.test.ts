import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { fakes } from "../test/setup"; // first: sets the env and the fake network
import * as C from "./connections";

// The Buffer session: tokens live in the database, refresh tokens are SINGLE USE (reusing one revokes the grant), so the rules are:
//   - a rotated token pair is saved BEFORE anything else can use the lease again;
//   - only one request refreshes at a time; the others wait and pick up the rotated tokens;
//   - a revoked grant is "log in again" (null), a Buffer outage is an error (the person stays logged in);
//   - no stale session is ever served after a save.

let n = 0;
const uid = () => `user-${++n}`; // the session cache is per user and lives for the process: every test gets its own
const future = () => Date.now() + 3_600_000;
const past = () => Date.now() - 1000;

/** A user whose stored access token has expired but whose refresh token still works. */
function expiredUser() {
  const user = uid();
  const rt = fakes.auth.issueRefreshToken();
  fakes.supabase.seedSession(user, { accessToken: "old-at", refreshToken: rt, expiresAt: past() });
  return { user, rt };
}
const names = () => fakes.supabase.calls.map((c) => c.name);

beforeEach(() => fakes.reset());

describe("getValidSession: nothing to refresh", () => {
  test("no connection at all: null, and Buffer is never called", async () => {
    assert.equal(await C.getValidSession(uid()), null);
    assert.equal(fakes.auth.requests.length, 0);
  });

  test("a live token is returned as saved, with no refresh and no lease", async () => {
    const user = uid();
    const s = { accessToken: "live-at", refreshToken: "rt-x", expiresAt: future() };
    fakes.supabase.seedSession(user, s);
    assert.deepEqual(await C.getValidSession(user), s);
    assert.equal(fakes.auth.requests.length, 0);
    assert.ok(!names().includes("acquire_refresh_lease"));
  });

  test("an expired token with no refresh token means log in again", async () => {
    const user = uid();
    fakes.supabase.seedSession(user, { accessToken: "old", expiresAt: past() });
    assert.equal(await C.getValidSession(user), null);
    assert.equal(fakes.auth.requests.length, 0);
    assert.ok(!names().includes("acquire_refresh_lease"), "nothing to refresh, so no lease taken");
  });

  test("a corrupt stored secret is treated as no session, not a crash", async () => {
    const user = uid();
    fakes.supabase.connections.set(`${user}:buffer`, { secret: "{not json", last4: null, meta: {}, status: "active", leaseHeld: false });
    assert.equal(await C.getValidSession(user), null);
  });

  test("a database error reading the session is an error, not 'logged out'", async () => {
    fakes.supabase.failRpc.get_connection_secret = { status: 500, message: "db down" };
    await assert.rejects(C.getValidSession(uid()), /Could not read the Buffer connection: db down/);
  });
});

describe("getValidSession: the cache", () => {
  test("a second call within the window does not touch the database", async () => {
    const user = uid();
    fakes.supabase.seedSession(user, { accessToken: "a", refreshToken: "r", expiresAt: future() });
    await C.getValidSession(user);
    const calls = fakes.supabase.calls.length;
    assert.equal((await C.getValidSession(user))?.accessToken, "a");
    assert.equal(fakes.supabase.calls.length, calls);
  });

  test("force skips the cache and refreshes even though the clock says the token is fine (Buffer answered 401)", async () => {
    const user = uid();
    const rt = fakes.auth.issueRefreshToken();
    fakes.supabase.seedSession(user, { accessToken: "looks-fine", refreshToken: rt, expiresAt: future() });
    await C.getValidSession(user); // cached
    const s = await C.getValidSession(user, { force: true });
    assert.notEqual(s?.accessToken, "looks-fine");
    assert.equal(fakes.auth.requests.length, 1);
    assert.equal(fakes.auth.requests[0].params.get("refresh_token"), rt);
  });

  test("saving a new session drops the cached one: nobody is served the old token afterwards", async () => {
    const user = uid();
    fakes.supabase.seedSession(user, { accessToken: "first", refreshToken: "r", expiresAt: future() });
    assert.equal((await C.getValidSession(user))?.accessToken, "first");
    await C.saveBufferSession(user, { accessToken: "second", refreshToken: "r2", expiresAt: future() });
    assert.equal((await C.getValidSession(user))?.accessToken, "second");
  });

  test("a null answer is not cached: logging in again works at once", async () => {
    const user = uid();
    assert.equal(await C.getValidSession(user), null);
    fakes.supabase.seedSession(user, { accessToken: "now", refreshToken: "r", expiresAt: future() });
    assert.equal((await C.getValidSession(user))?.accessToken, "now");
  });

  test("a cached session is not served once its token has expired", async () => {
    const user = uid();
    const rt = fakes.auth.issueRefreshToken();
    fakes.supabase.seedSession(user, { accessToken: "short", refreshToken: rt, expiresAt: Date.now() + 40 });
    assert.equal((await C.getValidSession(user))?.accessToken, "short");
    await new Promise((r) => setTimeout(r, 80));
    const s = await C.getValidSession(user);
    assert.notEqual(s?.accessToken, "short");
    assert.equal(fakes.auth.requests.length, 1);
  });
});

describe("getValidSession: refreshing", () => {
  test("refreshes with the stored refresh token and returns AND saves the new pair", async () => {
    const { user, rt } = expiredUser();
    const s = await C.getValidSession(user);
    assert.equal(fakes.auth.requests.length, 1);
    assert.equal(fakes.auth.requests[0].params.get("refresh_token"), rt);
    assert.ok(s && s.accessToken !== "old-at" && s.refreshToken !== rt);
    assert.deepEqual(fakes.supabase.storedSession(user), s, "what is stored is exactly what was returned");
  });

  test("the new tokens are saved BEFORE the lease is released (else another request could refresh with the used token)", async () => {
    const { user } = expiredUser();
    await C.getValidSession(user);
    const order = names().filter((x) => ["acquire_refresh_lease", "set_connection_secret", "release_refresh_lease"].includes(x));
    assert.deepEqual(order, ["acquire_refresh_lease", "set_connection_secret", "release_refresh_lease"]);
  });

  test("the lease is released afterwards, so the next expiry can refresh", async () => {
    const { user } = expiredUser();
    await C.getValidSession(user);
    assert.equal(fakes.supabase.conn(user, "buffer")?.leaseHeld, false);
  });

  test("refreshed again later: the second refresh uses the first refresh's NEW token", async () => {
    const { user } = expiredUser();
    const first = await C.getValidSession(user);
    fakes.supabase.seedSession(user, { ...first!, expiresAt: past() }); // time passes
    const second = await C.getValidSession(user, { force: true });
    assert.equal(fakes.auth.requests[1].params.get("refresh_token"), first!.refreshToken);
    assert.equal(fakes.auth.revoked, false, "no token was ever used twice");
    assert.notEqual(second?.accessToken, first?.accessToken);
  });

  test("a revoked or already-used grant is 'log in again' (null), the lease is freed, and the stored session is left alone", async () => {
    const user = uid();
    fakes.supabase.seedSession(user, { accessToken: "old", refreshToken: "rt-unknown", expiresAt: past() });
    assert.equal(await C.getValidSession(user), null);
    assert.equal(fakes.supabase.conn(user, "buffer")?.leaseHeld, false);
    assert.equal(fakes.supabase.storedSession(user)?.accessToken, "old");
    assert.ok(!names().includes("set_connection_secret"), "nothing was saved");
  });

  test("a Buffer outage is an error, NOT 'log in again': the person stays connected", async () => {
    const { user, rt } = expiredUser();
    fakes.auth.force = { status: 503, body: "maintenance" };
    await assert.rejects(C.getValidSession(user), (e: unknown) => (e as { status?: number }).status === 503);
    assert.equal(fakes.supabase.conn(user, "buffer")?.leaseHeld, false, "lease freed");
    assert.equal(fakes.supabase.storedSession(user)?.refreshToken, rt, "the refresh token is still there for the next try");
    fakes.auth.force = null;
    assert.ok(await C.getValidSession(user), "and the next try works");
  });

  test("a 4xx other than a revoked grant is also 'log in again'", async () => {
    const { user } = expiredUser();
    fakes.auth.force = { status: 401, body: "unauthorized_client" };
    assert.equal(await C.getValidSession(user), null);
  });

  test("if saving the rotated tokens fails the error is raised (the used refresh token is gone: this is the one case to know about), and the lease is freed", async () => {
    const { user } = expiredUser();
    fakes.supabase.failRpc.set_connection_secret = { status: 500, message: "vault down" };
    await assert.rejects(C.getValidSession(user), /Could not store the Buffer connection: vault down/);
    assert.equal(fakes.supabase.conn(user, "buffer")?.leaseHeld, false);
  });

  test("failing to release the lease does not fail the request", async () => {
    const { user } = expiredUser();
    fakes.supabase.failRpc.release_refresh_lease = { status: 500, message: "nope" };
    assert.ok(await C.getValidSession(user));
  });

  test("a failing lease call is an error naming the cause", async () => {
    const { user } = expiredUser();
    fakes.supabase.failRpc.acquire_refresh_lease = { status: 500, message: "lock table" };
    await assert.rejects(C.getValidSession(user), /Refresh lease failed: lock table/);
    assert.equal(fakes.auth.requests.length, 0, "Buffer is not asked without the lease");
  });

  test("if another request rotated the tokens while we were getting the lease, we use theirs and do NOT refresh", async () => {
    const { user } = expiredUser();
    fakes.supabase.beforeRpc = (name) => {
      if (name === "acquire_refresh_lease") fakes.supabase.seedSession(user, { accessToken: "theirs", refreshToken: "rt-theirs", expiresAt: future() });
    };
    const s = await C.getValidSession(user);
    assert.equal(s?.accessToken, "theirs");
    assert.equal(fakes.auth.requests.length, 0, "the old refresh token was not used again");
  });
});

describe("getValidSession: many requests at once", () => {
  test("five requests with an expired token: ONE refresh, everyone gets the same new session, the grant survives", async () => {
    const { user } = expiredUser();
    fakes.auth.beforeAnswer = () => new Promise((r) => setTimeout(r, 120)); // hold the refresh open while the others pile up
    const all = await Promise.all(Array.from({ length: 5 }, () => C.getValidSession(user)));
    assert.equal(fakes.auth.requests.length, 1, "exactly one call to Buffer");
    assert.equal(fakes.auth.revoked, false, "no refresh token was reused");
    assert.equal(new Set(all.map((s) => s?.accessToken)).size, 1, "all five got the same token");
    assert.ok(all[0]?.accessToken.startsWith("at-"));
    assert.equal(fakes.supabase.storedSession(user)?.accessToken, all[0]?.accessToken);
  });

  test("two different people refresh independently", async () => {
    const a = expiredUser();
    const b = expiredUser();
    const [sa, sb] = await Promise.all([C.getValidSession(a.user), C.getValidSession(b.user)]);
    assert.equal(fakes.auth.requests.length, 2);
    assert.notEqual(sa?.accessToken, sb?.accessToken);
    assert.equal(fakes.supabase.storedSession(a.user)?.accessToken, sa?.accessToken);
    assert.equal(fakes.supabase.storedSession(b.user)?.accessToken, sb?.accessToken);
  });

  test("a request that never gets the lease gives up with a clear error instead of waiting forever", async () => {
    const { user } = expiredUser();
    fakes.supabase.conn(user, "buffer")!.leaseHeld = true; // someone else holds it and never finishes
    const realSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((fn: () => void) => realSetTimeout(fn, 1)) as unknown as typeof setTimeout; // the 500 ms waits, shortened
    try {
      await assert.rejects(C.getValidSession(user), /Timed out waiting for another request to refresh the Buffer token/);
    } finally {
      globalThis.setTimeout = realSetTimeout;
    }
    assert.equal(fakes.auth.requests.length, 0);
    assert.equal(names().filter((x) => x === "acquire_refresh_lease").length, 10, "tried 10 times");
  });
});

describe("saving and loading the Buffer session", () => {
  test("the session is stored as one JSON secret for the buffer provider", async () => {
    const user = uid();
    await C.saveBufferSession(user, { accessToken: "a", refreshToken: "r", expiresAt: 123 });
    const call = fakes.supabase.calls.find((c) => c.name === "set_connection_secret")!;
    assert.equal(call.args.p_provider, "buffer");
    assert.deepEqual(JSON.parse(String(call.args.p_secret)), { accessToken: "a", refreshToken: "r", expiresAt: 123 });
    assert.deepEqual(await C.loadBufferSession(user), { accessToken: "a", refreshToken: "r", expiresAt: 123 });
  });

  test("a failed save is an error with the cause", async () => {
    fakes.supabase.failRpc.set_connection_secret = { status: 500, message: "disk full" };
    await assert.rejects(C.saveBufferSession(uid(), { accessToken: "a", expiresAt: 1 }), /Could not store the Buffer connection: disk full/);
  });

  test("loading: null when there is none, null for non-text, an error when the database fails", async () => {
    assert.equal(await C.loadBufferSession(uid()), null);
    fakes.supabase.failRpc.get_connection_secret = { status: 500, message: "boom" };
    await assert.rejects(C.loadBufferSession(uid()), /Could not read the Buffer connection: boom/);
  });
});

describe("upsertUser", () => {
  test("the first login creates the user and a brand profile, the next finds the same user", async () => {
    const a = await C.upsertUser("buffer-acct-1", "me@example.com");
    const b = await C.upsertUser("buffer-acct-1", "me@example.com");
    assert.equal(a, b);
    assert.ok(fakes.supabase.brandProfiles.has(a));
    const other = await C.upsertUser("buffer-acct-2");
    assert.notEqual(other, a);
  });

  test("a failure creating the user or the profile is an error, so a login can't half-succeed", async () => {
    fakes.supabase.failTable.users = { status: 500, message: "users table" };
    await assert.rejects(C.upsertUser("x"), /Could not save user/);
    fakes.supabase.failTable.users = undefined as never;
    delete fakes.supabase.failTable.users;
    fakes.supabase.failTable.brand_profiles = { status: 500, message: "profiles table" };
    await assert.rejects(C.upsertUser("y"), /Could not create brand profile: profiles table/);
  });
});

describe("the beehiiv key and the Apify token", () => {
  const pubs = [{ id: "pub_1", name: "Just a Phase" }] as never;

  test("the beehiiv key is stored with only its last four characters beside it", async () => {
    const user = uid();
    const r = await C.saveBeehiivKey(user, "bh_secret_abcd", pubs);
    assert.equal(r.last4, "abcd");
    const call = fakes.supabase.calls.find((c) => c.name === "set_connection_secret")!;
    assert.equal(call.args.p_provider, "beehiiv");
    assert.equal(call.args.p_last4, "abcd");
    assert.equal(await C.loadBeehiivKey(user), "bh_secret_abcd");
  });

  test("the connection read back never contains the key", async () => {
    const user = uid();
    await C.saveBeehiivKey(user, "bh_secret_abcd", pubs);
    const conn = await C.getBeehiivConnection(user);
    assert.equal(conn?.last4, "abcd");
    assert.equal(JSON.stringify(conn).includes("bh_secret"), false);
  });

  test("no connection, or one that stopped working, reads as null", async () => {
    const user = uid();
    assert.equal(await C.getBeehiivConnection(user), null);
    assert.equal(await C.loadBeehiivKey(user), null);
    await C.saveBeehiivKey(user, "bh_secret_abcd", pubs);
    fakes.supabase.conn(user, "beehiiv")!.status = "revoked";
    assert.equal(await C.getBeehiivConnection(user), null);
  });

  test("odd stored metadata is tolerated", async () => {
    const user = uid();
    await C.saveBeehiivKey(user, "bh_secret_abcd", pubs);
    const c = fakes.supabase.conn(user, "beehiiv")!;
    c.meta = { publications: "oops" } as never;
    c.last4 = 7 as never;
    assert.deepEqual(await C.getBeehiivConnection(user), { last4: "", publications: [] });
  });

  test("deleting removes the connection and the key", async () => {
    const user = uid();
    await C.saveBeehiivKey(user, "bh_secret_abcd", pubs);
    await C.deleteBeehiivConnection(user);
    assert.equal(await C.loadBeehiivKey(user), null);
    assert.equal(await C.getBeehiivConnection(user), null);
  });

  test("a publication's logo can be set and cleared; an unknown publication or no connection gives null", async () => {
    const user = uid();
    assert.equal(await C.setPublicationLogo(user, "pub_1", "https://x/logo.png"), null);
    await C.saveBeehiivKey(user, "bh_secret_abcd", pubs);
    assert.equal(await C.setPublicationLogo(user, "pub_other", "x"), null);
    const set = await C.setPublicationLogo(user, "pub_1", "https://x/logo.png");
    assert.equal(set?.[0].logo, "https://x/logo.png");
    assert.equal((await C.getBeehiivConnection(user))?.publications[0].logo, "https://x/logo.png");
    const cleared = await C.setPublicationLogo(user, "pub_1", null);
    assert.equal(cleared?.[0].logo, undefined);
  });

  test("withOrganization leaves a missing connection, or one that is already complete, alone and asks nobody", async () => {
    assert.equal(await C.withOrganization(uid(), null), null);
    const done = { last4: "abcd", publications: [{ id: "p", name: "n", organization: "Org" }] } as never;
    assert.equal(await C.withOrganization(uid(), done), done);
    const checked = { last4: "abcd", publications: [{ id: "p", name: "n", orgChecked: true }] } as never;
    assert.equal(await C.withOrganization(uid(), checked), checked);
  });

  test("the Apify token works like the beehiiv key", async () => {
    const user = uid();
    assert.equal(await C.getApifyConnection(user), null);
    assert.deepEqual(await C.saveApifyKey(user, "apify_api_wxyz"), { last4: "wxyz" });
    assert.deepEqual(await C.getApifyConnection(user), { last4: "wxyz" });
    assert.equal(await C.loadApifyKey(user), "apify_api_wxyz");
    await C.deleteApifyConnection(user);
    assert.equal(await C.getApifyConnection(user), null);
    assert.equal(await C.loadApifyKey(user), null);
  });

  test("storage errors name what failed", async () => {
    fakes.supabase.failRpc.set_connection_secret = { status: 500, message: "x" };
    await assert.rejects(C.saveBeehiivKey(uid(), "k", pubs), /Could not store the beehiiv key/);
    await assert.rejects(C.saveApifyKey(uid(), "k"), /Could not store the Apify token/);
    fakes.supabase.failRpc.delete_connection = { status: 500, message: "x" };
    await assert.rejects(C.deleteBeehiivConnection(uid()), /Could not remove the beehiiv key/);
    await assert.rejects(C.deleteApifyConnection(uid()), /Could not remove the Apify token/);
  });
});
