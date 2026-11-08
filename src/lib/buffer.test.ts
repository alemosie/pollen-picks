import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { fakes } from "../test/setup"; // first: sets the env and the fake network
import { jsonResponse } from "../test/fakes";
import * as B from "./buffer";

const saved = { NODE_ENV: process.env.NODE_ENV, BUFFER_FAKE: process.env.BUFFER_FAKE, BUFFER_FAKE_CHANNELS: process.env.BUFFER_FAKE_CHANNELS };

beforeEach(() => {
  fakes.reset();
  process.env.BUFFER_CLIENT_ID = "client-123";
  process.env.BUFFER_REDIRECT_URI = "https://pollen.test/api/auth/buffer/callback";
  delete process.env.BUFFER_CLIENT_SECRET;
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else (process.env as Record<string, string | undefined>)[k] = v;
  }
});

describe("settings from the environment", () => {
  test("a missing client id is an error, not a silent empty one", () => {
    delete process.env.BUFFER_CLIENT_ID;
    assert.throws(() => B.env(), /BUFFER_CLIENT_ID is not set/);
  });

  test("the redirect address defaults to the local dev one", () => {
    delete process.env.BUFFER_REDIRECT_URI;
    assert.equal(B.env().redirectUri, "https://localhost:3003/api/auth/buffer/callback");
  });

  test("redirects are built on the registered site origin, never on the request's host", () => {
    assert.equal(B.siteOrigin(), "https://pollen.test");
    assert.equal(B.siteUrl("/source").href, "https://pollen.test/source");
    assert.equal(B.siteUrl("/login?next=%2Fsend").href, "https://pollen.test/login?next=%2Fsend");
  });
});

describe("authorizeUrl", () => {
  test("goes to Buffer's auth host with PKCE, offline access and a consent prompt", () => {
    const u = new URL(B.authorizeUrl("state-1", "challenge-1"));
    assert.equal(u.origin + u.pathname, "https://auth.buffer.com/auth");
    assert.equal(u.searchParams.get("client_id"), "client-123");
    assert.equal(u.searchParams.get("redirect_uri"), "https://pollen.test/api/auth/buffer/callback");
    assert.equal(u.searchParams.get("response_type"), "code");
    assert.equal(u.searchParams.get("state"), "state-1");
    assert.equal(u.searchParams.get("code_challenge"), "challenge-1");
    assert.equal(u.searchParams.get("code_challenge_method"), "S256");
    assert.equal(u.searchParams.get("prompt"), "consent");
  });

  test("asks for exactly the scopes the app uses, and offline_access so it can refresh", () => {
    const scopes = new URL(B.authorizeUrl("s", "c")).searchParams.get("scope")!.split(" ").sort();
    assert.deepEqual(scopes, ["account:read", "offline_access", "posts:read", "posts:write"]);
    assert.equal(B.SCOPES, "account:read posts:read posts:write offline_access");
  });

  test("a state with special characters is encoded, not injected", () => {
    const u = new URL(B.authorizeUrl("a&scope=everything", "c"));
    assert.equal(u.searchParams.get("state"), "a&scope=everything");
    assert.equal(u.searchParams.get("scope"), B.SCOPES);
  });
});

describe("exchangeCode / refresh", () => {
  test("exchanging a code posts the PKCE verifier and returns a session that expires a minute early", async () => {
    fakes.auth.addCode("code-1", "verifier-1");
    const before = Date.now();
    const s = await B.exchangeCode("code-1", "verifier-1");
    const req = fakes.auth.requests[0];
    assert.equal(req.grant, "authorization_code");
    assert.equal(req.params.get("client_id"), "client-123");
    assert.equal(req.params.get("code"), "code-1");
    assert.equal(req.params.get("code_verifier"), "verifier-1");
    assert.equal(req.params.get("redirect_uri"), "https://pollen.test/api/auth/buffer/callback");
    assert.ok(s.accessToken.startsWith("at-"));
    assert.ok(s.refreshToken?.startsWith("rt-"));
    const lifetime = (s.expiresAt - before) / 1000;
    assert.ok(lifetime > 3600 - 60 - 5 && lifetime <= 3600 - 60 + 1, `expires a minute before Buffer says, got ${lifetime}s`);
  });

  test("the client secret is sent only when one is configured", async () => {
    fakes.auth.addCode("c1", "v");
    await B.exchangeCode("c1", "v");
    assert.equal(fakes.auth.requests[0].params.has("client_secret"), false);
    process.env.BUFFER_CLIENT_SECRET = "shh";
    fakes.auth.addCode("c2", "v");
    await B.exchangeCode("c2", "v");
    assert.equal(fakes.auth.requests[1].params.get("client_secret"), "shh");
  });

  test("a wrong verifier or a used code is a TokenError with Buffer's status", async () => {
    fakes.auth.addCode("c1", "right");
    await assert.rejects(B.exchangeCode("c1", "wrong"), (e: unknown) => e instanceof B.TokenError && e.status === 400 && /400/.test(e.message));
    await B.exchangeCode("c1", "right");
    await assert.rejects(B.exchangeCode("c1", "right"), (e: unknown) => e instanceof B.TokenError && e.status === 400, "a code works once");
  });

  test("refreshing posts the refresh token and returns the NEW pair", async () => {
    const rt = fakes.auth.issueRefreshToken();
    const s = await B.refresh(rt);
    assert.equal(fakes.auth.requests[0].grant, "refresh_token");
    assert.equal(fakes.auth.requests[0].params.get("refresh_token"), rt);
    assert.notEqual(s.refreshToken, rt, "Buffer rotates the refresh token");
    assert.ok(s.refreshToken);
  });

  test("a refresh token used twice is refused, and that kills the grant (the reason it must be saved at once)", async () => {
    const rt = fakes.auth.issueRefreshToken();
    const first = await B.refresh(rt);
    await assert.rejects(B.refresh(rt), B.TokenError);
    await assert.rejects(B.refresh(first.refreshToken!), (e: unknown) => e instanceof B.TokenError && e.status === 400, "even the new token no longer works");
  });

  test("an answer without a refresh token leaves refreshToken undefined", async () => {
    fakes.auth.omitRefreshToken = true;
    fakes.auth.addCode("c", "v");
    const s = await B.exchangeCode("c", "v");
    assert.equal(s.refreshToken, undefined);
  });

  test("a 5xx from Buffer is a TokenError too, so callers can tell it from a revoked grant by status", async () => {
    fakes.auth.force = { status: 503, body: "upstream down" };
    const rt = fakes.auth.issueRefreshToken();
    await assert.rejects(B.refresh(rt), (e: unknown) => e instanceof B.TokenError && e.status === 503 && /upstream down/.test(e.message));
  });

  test("TokenError carries its status and is an Error", () => {
    const e = new B.TokenError(401, "nope");
    assert.ok(e instanceof Error);
    assert.equal(e.status, 401);
    assert.equal(e.message, "nope");
  });
});

describe("gql", () => {
  test("sends the query as JSON with a Bearer token and returns data plus the status", async () => {
    fakes.graphql = () => jsonResponse({ data: { account: { id: "a1" } } });
    const r = await B.gql<{ account: { id: string } }>("tok-1", "{ account { id } }");
    assert.deepEqual(r.data, { account: { id: "a1" } });
    assert.equal(r.status, 200);
    assert.deepEqual(fakes.graphqlCalls, [{ query: "{ account { id } }", token: "tok-1" }]);
  });

  test("GraphQL errors come back as errors, alongside the status", async () => {
    fakes.graphql = () => jsonResponse({ errors: [{ message: "Not authorized" }] }, 200);
    const r = await B.gql("tok", "{ x }");
    assert.equal(r.errors?.[0].message, "Not authorized");
    assert.equal(r.data, undefined);
  });

  test("a non-JSON answer (a gateway error page) still returns the status instead of throwing", async () => {
    fakes.graphql = () => new Response("<html>Bad gateway</html>", { status: 502 });
    const r = await B.gql("tok", "{ x }");
    assert.equal(r.status, 502);
    assert.equal(r.data, undefined);
  });

  test("a 429 and a 401 are visible to the caller by status", async () => {
    for (const status of [429, 401]) {
      fakes.graphql = () => jsonResponse({ errors: [{ message: "x" }] }, status);
      assert.equal((await B.gql("tok", "{ x }")).status, status);
    }
  });

  test("a timeout aborts the request and throws, so the caller can decide what it means", async () => {
    fakes.graphql = () => new Promise<Response>(() => {}); // never answers
    // AbortSignal.timeout() does not keep the process alive on its own: with nothing else pending, Node can decide the event loop is empty and cancel the
    // test before the timeout fires (it did, now and then). A timer of our own holds the loop open until the timeout has had its say.
    const keepAlive = setTimeout(() => {}, 5_000);
    try {
      await assert.rejects(B.gql("tok", "{ x }", { timeoutMs: 25 }), (e: unknown) => (e as Error).name === "TimeoutError");
    } finally {
      clearTimeout(keepAlive);
    }
  });

  test("without a timeout nothing is aborted", async () => {
    fakes.graphql = () => jsonResponse({ data: { ok: true } });
    assert.deepEqual((await B.gql("tok", "{ x }")).data, { ok: true });
  });
});

describe("listChannels", () => {
  const orgs = (ids: string[]) => jsonResponse({ data: { account: { organizations: ids.map((id) => ({ id })) } } });

  test("asks for the account's organizations, then one channels request per organization", async () => {
    fakes.graphql = (q) => {
      if (q.includes("organizations")) return orgs(["org_1", "org_2"]);
      if (q.includes('"org_1"')) return jsonResponse({ data: { channels: [{ id: "c1", name: "Page A", service: "linkedin" }] } });
      if (q.includes('"org_2"')) return jsonResponse({ data: { channels: [{ id: "c2", name: "Insta B", service: "instagram" }, { id: "c3", name: "Insta C", service: "instagram" }] } });
      return jsonResponse({ errors: [{ message: "unexpected" }] });
    };
    const out = await B.listChannels("tok");
    assert.deepEqual(out.map((c) => c.id), ["c1", "c2", "c3"]);
    assert.equal(fakes.graphqlCalls.length, 3);
    assert.ok(fakes.graphqlCalls.every((c) => c.token === "tok"));
  });

  test("organizations are asked in parallel, not one after another", async () => {
    let inFlight = 0;
    let max = 0;
    fakes.graphql = async (q) => {
      if (q.includes("organizations")) return orgs(["a", "b", "c"]);
      inFlight++;
      max = Math.max(max, inFlight);
      await new Promise((r) => setTimeout(r, 15));
      inFlight--;
      return jsonResponse({ data: { channels: [] } });
    };
    await B.listChannels("tok");
    assert.equal(max, 3);
  });

  test("an organization id is quoted safely in the query", async () => {
    fakes.graphql = (q) => (q.includes("organizations") ? orgs(['x") { id } mutation { y']) : jsonResponse({ data: { channels: [] } }));
    await B.listChannels("tok");
    const q = fakes.graphqlCalls[1].query;
    assert.ok(q.includes('organizationId: "x\\") { id } mutation { y"'));
  });

  test("one organization failing does not lose the others", async () => {
    fakes.graphql = (q) => {
      if (q.includes("organizations")) return orgs(["ok", "bad"]);
      return q.includes('"bad"') ? jsonResponse({ errors: [{ message: "denied" }] }, 403) : jsonResponse({ data: { channels: [{ id: "c1", name: "Fine", service: "linkedin" }] } });
    };
    assert.deepEqual((await B.listChannels("tok")).map((c) => c.id), ["c1"]);
  });

  test("locked and disconnected channels are left out, and the query asks for those flags", async () => {
    fakes.graphql = (q) => {
      if (q.includes("organizations")) return orgs(["o"]);
      return jsonResponse({ data: { channels: [
        { id: "ok", name: "Fine", service: "linkedin", isLocked: false, isDisconnected: false },
        { id: "locked", name: "Over plan", service: "threads", isLocked: true, isDisconnected: false },
        { id: "gone", name: "Disconnected", service: "instagram", isLocked: false, isDisconnected: true },
      ] } });
    };
    const out = await B.listChannels("tok");
    assert.deepEqual(out, [{ id: "ok", name: "Fine", service: "linkedin" }]);
    const q = fakes.graphqlCalls[1].query;
    assert.ok(q.includes("isLocked") && q.includes("isDisconnected"));
  });

  test("an account with no organizations, or an unreadable account, gives no channels", async () => {
    fakes.graphql = () => orgs([]);
    assert.deepEqual(await B.listChannels("tok"), []);
    fakes.graphql = () => jsonResponse({ errors: [{ message: "bad token" }] }, 401);
    assert.deepEqual(await B.listChannels("tok"), []);
  });

  test("fake channels are added only in fake mode", async () => {
    fakes.graphql = () => orgs([]);
    (process.env as Record<string, string>).NODE_ENV = "test";
    process.env.BUFFER_FAKE = "1";
    process.env.BUFFER_FAKE_CHANNELS = "3";
    const prev = process.cwd();
    process.chdir((await import("node:fs")).mkdtempSync((await import("node:path")).join((await import("node:os")).tmpdir(), "pp-ch-")));
    try {
      const out = await B.listChannels("tok");
      assert.deepEqual(out.map((c) => c.id), ["fake-ch-1", "fake-ch-2", "fake-ch-3"]);
      (process.env as Record<string, string>).NODE_ENV = "production";
      assert.deepEqual(await B.listChannels("tok"), [], "never on the live site");
    } finally {
      process.chdir(prev);
    }
  });

  test("fake mode can add a locked and a disconnected channel: Buffer lists them, the picker's list does not", async () => {
    fakes.graphql = () => orgs([]);
    const env = process.env as Record<string, string | undefined>;
    const saved = { NODE_ENV: env.NODE_ENV, BUFFER_FAKE: env.BUFFER_FAKE, BUFFER_FAKE_CHANNELS: env.BUFFER_FAKE_CHANNELS, BUFFER_FAKE_UNAVAILABLE: env.BUFFER_FAKE_UNAVAILABLE };
    env.NODE_ENV = "test";
    env.BUFFER_FAKE = "1";
    env.BUFFER_FAKE_CHANNELS = "2";
    env.BUFFER_FAKE_UNAVAILABLE = "1";
    const prev = process.cwd();
    process.chdir((await import("node:fs")).mkdtempSync((await import("node:path")).join((await import("node:os")).tmpdir(), "pp-ch-")));
    try {
      const { fakeChannels } = await import("./fake");
      const raw = fakeChannels();
      assert.ok(raw.some((c) => c.isLocked) && raw.some((c) => c.isDisconnected), "the fake list carries both kinds");
      assert.deepEqual((await B.listChannels("tok")).map((c) => c.id), ["fake-ch-1", "fake-ch-2"]);
      env.BUFFER_FAKE_UNAVAILABLE = "0";
      assert.equal(fakeChannels().length, 2, "off: only the plain fake channels");
    } finally {
      process.chdir(prev);
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete env[k];
        else env[k] = v;
      }
    }
  });
});

describe("isRateLimited", () => {
  const limit = { message: "x", extensions: { code: "RATE_LIMIT_EXCEEDED", window: "15m" } };
  test("an HTTP 429, whatever the body", () => {
    assert.equal(B.isRateLimited({ status: 429 }), true);
    assert.equal(B.isRateLimited({ status: 429, errors: [{ message: "x" }] }), true);
  });
  test("RATE_LIMIT_EXCEEDED in the errors, on any status", () => {
    for (const status of [200, 400, 500]) assert.equal(B.isRateLimited({ status, errors: [limit] }), true, String(status));
    assert.equal(B.isRateLimited({ status: 200, errors: [{ message: "a" }, limit] }), true);
  });
  test("nothing else is a rate limit", () => {
    assert.equal(B.isRateLimited({ status: 200 }), false);
    assert.equal(B.isRateLimited({ status: 500, errors: [{ message: "x" }] }), false);
    assert.equal(B.isRateLimited({ status: 401, errors: [{ message: "x", extensions: { code: "UNAUTHORIZED" } }] }), false);
    assert.equal(B.isRateLimited({ status: 200, errors: [{ message: "x", extensions: { code: "rate_limit_exceeded" } }] }), false);
    assert.equal(B.isRateLimited({ status: 200, errors: [{ message: "x", extensions: {} }] }), false);
  });
  test("odd answers do not throw", () => {
    assert.equal(B.isRateLimited({ status: 200, errors: [null as never] }), false);
    assert.equal(B.isRateLimited({ status: 200, errors: "boom" as never }), false);
  });
});
