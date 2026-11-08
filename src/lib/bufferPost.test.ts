import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import { createChannelPost, getPostState, getPostStates, NOW_MODE, type ChannelPostInput } from "./bufferPost";

// These run the real createChannelPost / getPostState(s) against a stubbed fetch, so they check what we send to Buffer and how every kind of
// answer is classified. The classification is what the send queue relies on: a 429 is safe to retry (nothing was created), an unknown
// outcome on a publish is NEVER retried (it may already be live), anything else is a plain failure.

const realFetch = globalThis.fetch;
const realSetTimeout = globalThis.setTimeout;
const realCwd = process.cwd();
const savedEnv = { NODE_ENV: process.env.NODE_ENV, BUFFER_FAKE: process.env.BUFFER_FAKE };

type Call = { url: string; query: string };
let calls: Call[] = [];
// NODE_ENV is typed read-only; fake mode and production behave differently on it, so the tests set it on purpose.
const setEnv = (k: string, v: string) => void ((process.env as Record<string, string | undefined>)[k] = v);

function stubFetch(handler: (call: Call, n: number) => Response | Promise<Response>) {
  calls = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), query: JSON.parse(String(init?.body ?? "{}")).query as string };
    calls.push(call);
    return handler(call, calls.length);
  }) as typeof fetch;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const created = (id = "post_1") => json({ data: { createPost: { post: { id } } } });

const input = (over: Partial<ChannelPostInput> = {}): ChannelPostInput => ({
  channelId: "ch_1",
  service: "linkedin",
  text: 'Hello "quoted"\nsecond line',
  images: ["https://example.test/a.png", "https://example.test/b.png"],
  intent: "draft",
  ...over,
});

beforeEach(() => {
  // Real mode: never fake, whatever the machine's .dev-fake.json or env says.
  setEnv("NODE_ENV", "production");
  delete process.env.BUFFER_FAKE;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  globalThis.setTimeout = realSetTimeout;
  process.chdir(realCwd);
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("createChannelPost: what we send", () => {
  test("a draft is queued with saveToDraft, never shareNow", async () => {
    stubFetch(() => created());
    const out = await createChannelPost("tok", input({ intent: "draft" }));
    assert.deepEqual(out, { ok: true, postId: "post_1" });
    const q = calls[0].query;
    assert.match(q, /mode: addToQueue/);
    assert.match(q, /saveToDraft: true/);
    assert.doesNotMatch(q, new RegExp(NOW_MODE));
    assert.match(q, /schedulingType: automatic/);
  });

  test("publish now uses shareNow and does NOT save a draft", async () => {
    stubFetch(() => created());
    await createChannelPost("tok", input({ intent: "now" }));
    const q = calls[0].query;
    assert.match(q, new RegExp(`mode: ${NOW_MODE}`));
    assert.doesNotMatch(q, /saveToDraft/);
    assert.doesNotMatch(q, /addToQueue/);
  });

  test("slides go as assets in order, and the caption is escaped safely", async () => {
    stubFetch(() => created());
    await createChannelPost("tok", input());
    const q = calls[0].query;
    assert.ok(q.indexOf("a.png") < q.indexOf("b.png"));
    assert.match(q, /assets: \[\{ image: \{ url: "https:\/\/example\.test\/a\.png" \} \}, \{ image: \{ url: "https:\/\/example\.test\/b\.png" \} \}\]/);
    // The quote and the newline are JSON-escaped, so the caption can't break out of the query.
    assert.ok(q.includes('text: "Hello \\"quoted\\"\\nsecond line"'));
    assert.ok(q.includes('channelId: "ch_1"'));
  });

  test("a hostile caption stays inside the string", async () => {
    stubFetch(() => created());
    await createChannelPost("tok", input({ text: '"}) { id } } mutation { deletePost(input: {id: "x"}' }));
    assert.ok(calls[0].query.includes('text: "\\"}) { id } } mutation { deletePost(input: {id: \\"x\\"}"'));
  });

  test("Instagram gets feed metadata, other networks do not", async () => {
    stubFetch(() => created());
    await createChannelPost("tok", input({ service: "instagram" }));
    assert.match(calls[0].query, /metadata: \{ instagram: \{ type: post, shouldShareToFeed: true \} \}/);
    await createChannelPost("tok", input({ service: "Instagram" }));
    assert.match(calls[1].query, /metadata: \{ instagram/);
    await createChannelPost("tok", input({ service: "linkedin" }));
    assert.doesNotMatch(calls[2].query, /metadata/);
  });

  test("the token goes in the Authorization header", async () => {
    let auth = "";
    globalThis.fetch = (async (_u: RequestInfo | URL, init?: RequestInit) => {
      auth = new Headers(init?.headers).get("Authorization") ?? "";
      return created();
    }) as typeof fetch;
    await createChannelPost("secret-token", input());
    assert.equal(auth, "Bearer secret-token");
  });
});

describe("createChannelPost: classifying the answer", () => {
  test("a 429 is rateLimited and safe to retry, for a draft and for a publish", async () => {
    for (const intent of ["draft", "now"] as const) {
      stubFetch(() => json({ errors: [{ message: "Too many requests" }] }, 429));
      const out = await createChannelPost("tok", input({ intent }));
      assert.equal(out.ok, false);
      assert.equal(out.ok === false && out.rateLimited, true);
      assert.notEqual(out.ok === false && out.unknown, true, "a 429 created nothing, so it is not 'unknown'");
    }
  });

  test("a 429 with an empty body is still rateLimited", async () => {
    stubFetch(() => new Response("", { status: 429 }));
    const out = await createChannelPost("tok", input());
    assert.equal(out.ok === false && out.rateLimited, true);
  });

  // Buffer's docs describe the rate limit two ways: HTTP 429 (Rate Limits guide) and HTTP 200 with RATE_LIMIT_EXCEEDED in the errors (Error Handling guide).
  const limitBody = { data: null, errors: [{ message: "Too many requests from this client. Please try again later.", extensions: { code: "RATE_LIMIT_EXCEEDED", window: "15m" } }] };
  test("RATE_LIMIT_EXCEEDED in the answer is rateLimited too, even on an HTTP 200", async () => {
    for (const intent of ["draft", "now"] as const) {
      stubFetch(() => json(limitBody, 200));
      const out = await createChannelPost("tok", input({ intent }));
      assert.equal(out.ok === false && out.rateLimited, true, intent);
      assert.notEqual(out.ok === false && out.unknown, true, "nothing was created, so it is not 'unknown'");
    }
  });
  test("RATE_LIMIT_EXCEEDED among other errors still counts", async () => {
    stubFetch(() => json({ errors: [{ message: "x", extensions: { code: "UNEXPECTED" } }, ...limitBody.errors] }, 200));
    const out = await createChannelPost("tok", input());
    assert.equal(out.ok === false && out.rateLimited, true);
  });
  test("other error codes are plain failures, not rate limits (and never retried by the queue)", async () => {
    for (const code of ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "UNEXPECTED", "rate_limit_exceeded", ""]) {
      stubFetch(() => json({ errors: [{ message: "nope", extensions: { code } }] }, 200));
      const out = await createChannelPost("tok", input({ intent: "now" }));
      assert.equal(out.ok, false, code);
      assert.notEqual(out.ok === false && out.rateLimited, true, code);
      assert.notEqual(out.ok === false && out.unknown, true, `${code}: an HTTP 200 answer is a clear no`);
    }
  });
  test("an error without extensions, or with a malformed one, does not break the check", async () => {
    for (const errors of [[{ message: "a" }], [{ message: "a", extensions: null }], [{ message: "a", extensions: "x" }], [null], []]) {
      stubFetch(() => json({ errors }, 200));
      const out = await createChannelPost("tok", input());
      assert.equal(out.ok, false);
      assert.notEqual(out.ok === false && out.rateLimited, true);
    }
  });
  test("a 429 still wins whatever the body says", async () => {
    stubFetch(() => json({ errors: [{ message: "x", extensions: { code: "UNEXPECTED" } }] }, 429));
    const out = await createChannelPost("tok", input({ intent: "now" }));
    assert.equal(out.ok === false && out.rateLimited, true);
  });

  test("a 5xx on a publish is UNKNOWN: it may be live, so it must never be retried", async () => {
    stubFetch(() => json({ errors: [{ message: "Internal error" }] }, 502));
    const out = await createChannelPost("tok", input({ intent: "now" }));
    assert.equal(out.ok === false && out.unknown, true);
    assert.notEqual(out.ok === false && out.rateLimited, true);
  });

  test("a 5xx on a draft is a plain failure (a stray draft is harmless)", async () => {
    stubFetch(() => json({ errors: [{ message: "Internal error" }] }, 500));
    const out = await createChannelPost("tok", input({ intent: "draft" }));
    assert.equal(out.ok, false);
    assert.equal(out.ok === false && out.unknown, false);
  });

  test("a dropped connection or timeout on a publish is UNKNOWN", async () => {
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    const out = await createChannelPost("tok", input({ intent: "now" }));
    assert.equal(out.ok === false && out.unknown, true);
    assert.equal(out.ok === false && out.error, "fetch failed");
  });

  test("a dropped connection on a draft is a plain failure", async () => {
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    const out = await createChannelPost("tok", input({ intent: "draft" }));
    assert.equal(out.ok === false && out.unknown, false);
  });

  test("Buffer's own refusal (MutationError) is a clean failure with its message, even for a publish", async () => {
    stubFetch(() => json({ data: { createPost: { message: "Instagram posts need at least one image" } } }));
    const out = await createChannelPost("tok", input({ intent: "now" }));
    assert.deepEqual(out, { ok: false, error: "Instagram posts need at least one image", unknown: false });
  });

  test("GraphQL errors surface the first message", async () => {
    stubFetch(() => json({ errors: [{ message: "Not authorized" }, { message: "second" }] }, 200));
    const out = await createChannelPost("tok", input({ intent: "draft" }));
    assert.equal(out.ok === false && out.error, "Not authorized");
  });

  test("a 401 is a clean failure, not unknown and not retried", async () => {
    stubFetch(() => json({ errors: [{ message: "Unauthorized" }] }, 401));
    const out = await createChannelPost("tok", input({ intent: "now" }));
    assert.equal(out.ok === false && out.unknown, false);
    assert.notEqual(out.ok === false && out.rateLimited, true);
    assert.equal(calls.length, 1, "createChannelPost itself never retries");
  });

  test("an answer with neither a post nor an error still fails, with the status", async () => {
    stubFetch(() => json({ data: { createPost: {} } }, 200));
    const out = await createChannelPost("tok", input());
    assert.equal(out.ok, false);
    assert.equal(out.ok === false && out.error, "Buffer returned 200");
  });

  test("an error alongside a post is not treated as success", async () => {
    stubFetch(() => json({ data: { createPost: { post: { id: "p" } } }, errors: [{ message: "partial" }] }));
    const out = await createChannelPost("tok", input());
    assert.equal(out.ok, false);
  });

  test("exactly one request per call, whatever the outcome", async () => {
    for (const status of [200, 429, 500]) {
      stubFetch(() => json({ errors: [{ message: "x" }] }, status));
      await createChannelPost("tok", input({ intent: "now" }));
      assert.equal(calls.length, 1);
    }
  });
});

describe("getPostState / getPostStates", () => {
  test("one post: status, sentAt and link", async () => {
    stubFetch(() => json({ data: { post: { id: "p1", status: "sent", sentAt: "2026-11-08T10:00:00Z", externalLink: "https://instagram.com/p/x" } } }));
    assert.deepEqual(await getPostState("tok", "p1"), { status: "sent", sentAt: "2026-11-08T10:00:00Z", externalLink: "https://instagram.com/p/x" });
  });

  test("a missing post is an error, not a status", async () => {
    stubFetch(() => json({ data: { post: null }, errors: [{ message: "Post not found" }] }));
    assert.deepEqual(await getPostState("tok", "p1"), { error: "Post not found" });
  });

  test("a failed read is an error (the row must stay as it was)", async () => {
    stubFetch(() => {
      throw new Error("timeout");
    });
    assert.deepEqual(await getPostState("tok", "p1"), { error: "timeout" });
  });

  test("many posts go in one aliased request, 25 at a time", async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `p${i}`);
    stubFetch((call) => {
      const aliases = [...call.query.matchAll(/p(\d+): post\(input: \{ id: "([^"]+)" \}\)/g)];
      return json({ data: Object.fromEntries(aliases.map(([, k, id]) => [`p${k}`, { id, status: "draft" }])) });
    });
    const out = await getPostStates("tok", ids);
    assert.equal(calls.length, 3, "60 posts = 25 + 25 + 10");
    assert.equal(Object.keys(out).length, 60);
    assert.deepEqual(out.p0, { status: "draft", sentAt: null, externalLink: null });
    assert.deepEqual(out.p59, { status: "draft", sentAt: null, externalLink: null });
    for (const c of calls) assert.ok((c.query.match(/: post\(/g) ?? []).length <= 25);
  });

  test("the answers land on the right ids even when Buffer returns some posts as null", async () => {
    stubFetch(() => json({ data: { p0: { id: "a", status: "sent" }, p1: null, p2: { id: "c", status: "scheduled" } } }));
    const out = await getPostStates("tok", ["a", "b", "c"]);
    assert.equal("status" in out.a && out.a.status, "sent");
    assert.ok("error" in out.b);
    assert.equal("status" in out.c && out.c.status, "scheduled");
  });

  test("RATE_LIMIT_EXCEEDED on a read (HTTP 200) says Buffer is limiting requests, for every post in that request", async () => {
    stubFetch(() => json({ data: null, errors: [{ message: "x", extensions: { code: "RATE_LIMIT_EXCEEDED" } }] }, 200));
    const out = await getPostStates("tok", ["a", "b"]);
    for (const id of ["a", "b"]) {
      const s = out[id];
      assert.ok("error" in s && /limiting requests/.test(s.error), id);
    }
  });
  test("a 429 on a read says Buffer is limiting requests, for every post in that request", async () => {
    stubFetch(() => json({ errors: [{ message: "slow down" }] }, 429));
    const out = await getPostStates("tok", ["a", "b"]);
    assert.deepEqual(out.a, { error: "Buffer is limiting requests right now." });
    assert.deepEqual(out.b, { error: "Buffer is limiting requests right now." });
  });

  test("one failed chunk does not lose the others", async () => {
    const ids = Array.from({ length: 30 }, (_, i) => `p${i}`);
    stubFetch((call, n) => {
      if (n === 1) throw new Error("boom");
      const aliases = [...call.query.matchAll(/p(\d+): post\(input: \{ id: "([^"]+)" \}\)/g)];
      return json({ data: Object.fromEntries(aliases.map(([, k, id]) => [`p${k}`, { id, status: "sent" }])) });
    });
    const out = await getPostStates("tok", ids);
    assert.deepEqual(out.p0, { error: "boom" });
    assert.equal("status" in out.p29 && out.p29.status, "sent");
  });
});

describe("fake mode behaves like Buffer on its bad days", () => {
  // Fake mode reads .dev-fake.json from the working directory, so run in an empty folder: the machine's own settings can't leak in.
  beforeEach(() => {
    process.chdir(mkdtempSync(join(tmpdir(), "pp-fake-")));
    setEnv("NODE_ENV", "test");
    process.env.BUFFER_FAKE = "1";
    delete process.env.BUFFER_FAKE_FAIL;
    delete process.env.BUFFER_FAKE_UNKNOWN;
    delete process.env.BUFFER_FAKE_PUBLISH_FAIL;
    delete process.env.BUFFER_FAKE_RATE_LIMIT;
    delete process.env.BUFFER_FAKE_LIMITS;
    // Fake mode sleeps to imitate Buffer's latency: skip the wait.
    globalThis.setTimeout = ((fn: () => void) => realSetTimeout(fn, 0)) as unknown as typeof setTimeout;
  });

  test("fake mode never calls Buffer", async () => {
    stubFetch(() => {
      throw new Error("must not be called");
    });
    const out = await createChannelPost("tok", input({ intent: "draft" }));
    assert.equal(out.ok, true);
    assert.equal(calls.length, 0);
  });

  test("production never honours BUFFER_FAKE", async () => {
    setEnv("NODE_ENV", "production");
    stubFetch(() => created("real_1"));
    const out = await createChannelPost("tok", input());
    assert.deepEqual(out, { ok: true, postId: "real_1" });
    assert.equal(calls.length, 1);
  });

  test("a failing network fails cleanly", async () => {
    process.env.BUFFER_FAKE_FAIL = "linkedin";
    const out = await createChannelPost("tok", input({ service: "linkedin", intent: "now" }));
    assert.equal(out.ok, false);
    assert.notEqual(out.ok === false && out.unknown, true);
  });

  test("an 'unknown' network is unknown for a publish but not for a draft", async () => {
    process.env.BUFFER_FAKE_UNKNOWN = "linkedin";
    const now = await createChannelPost("tok", input({ intent: "now" }));
    const draft = await createChannelPost("tok", input({ intent: "draft" }));
    assert.equal(now.ok === false && now.unknown, true);
    assert.equal(draft.ok === false && draft.unknown, false);
  });

  test("the first N creates get a 429, then it works", async () => {
    process.env.BUFFER_FAKE_RATE_LIMIT = "2";
    const outs = [];
    for (let i = 0; i < 4; i++) outs.push(await createChannelPost("tok", input()));
    assert.deepEqual(
      outs.map((o) => (o.ok ? "ok" : o.rateLimited ? "429" : "fail")),
      ["429", "429", "ok", "ok"],
    );
  });

  test("a fake publish shows as sending, then sent; a draft stays a draft", async () => {
    const now = await createChannelPost("tok", input({ intent: "now" }));
    const draft = await createChannelPost("tok", input({ intent: "draft" }));
    assert.ok(now.ok && draft.ok);
    if (!now.ok || !draft.ok) return;
    assert.equal((await getPostState("tok", now.postId) as { status: string }).status, "sending");
    assert.equal((await getPostState("tok", draft.postId) as { status: string }).status, "draft");
  });

  test("a publish that Buffer accepts and then fails ends as error", async () => {
    process.env.BUFFER_FAKE_PUBLISH_FAIL = "linkedin";
    const out = await createChannelPost("tok", input({ intent: "now" }));
    assert.ok(out.ok);
    if (!out.ok) return;
    const realNow = Date.now;
    Date.now = () => realNow() + 60_000; // past FAKE_PUBLISH_MS
    try {
      assert.equal((await getPostState("tok", out.postId) as { status: string }).status, "error");
    } finally {
      Date.now = realNow;
    }
  });

  test("with limits on, a publish over the limit is refused but a draft is allowed", async () => {
    process.env.BUFFER_FAKE_LIMITS = "1";
    const long = "x".repeat(5000);
    const now = await createChannelPost("tok", input({ service: "linkedin", intent: "now", text: long }));
    const draft = await createChannelPost("tok", input({ service: "linkedin", intent: "draft", text: long }));
    assert.equal(now.ok, false);
    assert.equal(draft.ok, true);
  });
});
