import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { imageLimit } from "./channels";
import type { ChannelPostInput, ChannelPostOutcome, PostDocument } from "./bufferPost";
import { enqueue, processQueue, type Claimed, type Context, type QueueDeps, type QueueRequest } from "./sendQueue";

// The send queue's promises, checked without a database, a Buffer account or a beehiiv key:
//   - never twice: a row is sent by one worker only; an unclear publish, or a worker that dies mid-send, is never retried;
//   - Buffer's 429 means nothing was created, so it is waited out with a growing delay and the whole run slows down;
//   - the caption is erased once the post exists, and kept for a failed or unclear one so "Send again" has something to send;
//   - a send that can't start (login expired, a slide can't be drawn) fails every channel with a reason and sends nothing.
//
// The database is an in-memory post_history table. Its claim_queued_posts mirrors db/supabase/0019_keep_caption_when_unknown.sql (the real one is
// SQL, and the SQL itself is not run by these tests).

type Row = {
  id: number;
  user_id: string;
  batch_id: string;
  channel_id: string;
  service: string;
  mode: "draft" | "now";
  source: string | null;
  picks: number[] | null;
  template: string | null;
  caption: string | null;
  attempts: number;
  status: string;
  post_id?: string | null;
  slides?: number | null;
  error?: string | null;
  lease_until?: string | null;
  not_before?: string | null;
  [k: string]: unknown;
};

let nextId = 1;
const makeRow = (over: Partial<Row> = {}): Row => ({
  id: nextId++,
  user_id: "u1",
  batch_id: "b1",
  channel_id: "ch1",
  service: "linkedin",
  mode: "draft",
  source: "own",
  picks: [1, 2],
  template: "",
  caption: "Hello",
  attempts: 0,
  status: "queued",
  error: null,
  post_id: null,
  lease_until: null,
  not_before: null,
  ...over,
});

class FakeDb {
  rows: Row[] = [];
  /** Every filter+patch pair that was sent, to check that updates only touch rows that are still 'working'. */
  updates: { filters: [string, string, unknown][]; patch: Record<string, unknown> }[] = [];

  add(...rows: Row[]) {
    this.rows.push(...rows);
    return this;
  }
  byId = (id: number) => this.rows.find((r) => r.id === id)!;

  private claim(args: { p_user_id: string | null; p_limit: number; p_lease_seconds: number }): Row[] {
    const now = Date.now();
    // A row whose worker died while 'working' is never retried: it becomes 'unknown' (caption kept, per 0019).
    for (const r of this.rows)
      if (r.status === "working" && r.lease_until && Date.parse(r.lease_until) < now) {
        r.status = "unknown";
        r.lease_until = null;
        r.error = "This was interrupted, so it may or may not have gone out. Check Buffer before sending it again.";
      }
    const due = this.rows
      .filter((r) => r.status === "queued" && (!r.not_before || Date.parse(r.not_before) <= now) && (!args.p_user_id || r.user_id === args.p_user_id))
      .sort((a, b) => a.id - b.id)
      .slice(0, args.p_limit);
    for (const r of due) {
      r.status = "working";
      r.lease_until = new Date(now + args.p_lease_seconds * 1000).toISOString();
      r.attempts += 1;
    }
    return due.map((r) => ({ ...r }));
  }

  client = {
    rpc: async (name: string, args: { p_user_id: string | null; p_limit: number; p_lease_seconds: number }) => {
      assert.equal(name, "claim_queued_posts");
      return { data: this.claim(args), error: null };
    },
    from: (table: string) => {
      assert.equal(table, "post_history");
      return {
        insert: async (rows: Partial<Row>[]) => {
          if (this.insertError) return { error: { message: this.insertError } };
          // A database that doesn't have a column yet refuses a row that carries it, the way PostgREST does.
          const unknown = this.missingColumns.find((c) => rows.some((r) => c in r));
          if (unknown) return { error: { message: `Could not find the '${unknown}' column of 'post_history' in the schema cache` } };
          for (const r of rows) this.rows.push({ id: nextId++, attempts: 0, ...r } as Row);
          return { error: null };
        },
        update: (patch: Record<string, unknown>) => {
          const filters: [string, string, unknown][] = [];
          const q = {
            eq: (col: string, v: unknown) => (filters.push([col, "eq", v]), q),
            in: (col: string, v: unknown[]) => (filters.push([col, "in", v]), q),
            then: (res: (v: { error: null }) => unknown, rej?: (e: unknown) => unknown) => {
              this.updates.push({ filters, patch });
              for (const r of this.rows)
                if (filters.every(([c, op, v]) => (op === "eq" ? r[c] === v : (v as unknown[]).includes(r[c])))) Object.assign(r, patch);
              return Promise.resolve({ error: null }).then(res, rej);
            },
          };
          return q;
        },
      };
    },
  };
  insertError: string | null = null;
  missingColumns: string[] = [];
}

type Post = ChannelPostInput & { token: string };

function setup(opts: { session?: "ok" | "none" | "throws"; post?: (p: ChannelPostInput, n: number) => ChannelPostOutcome | Promise<ChannelPostOutcome>; context?: (row: Claimed) => Context; warm?: (urls: string[]) => string | null; pdf?: (row: Claimed) => PostDocument | null; fake?: boolean } = {}) {
  const fake = new FakeDb();
  const posts: Post[] = [];
  const logged: { service: string; ok: boolean; error?: string; mode?: string }[] = [];
  const contextCalls: string[] = [];
  const warmCalls: string[][] = [];
  const pdfCalls: string[] = [];
  const sessionCalls: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;

  const deps: QueueDeps = {
    db: () => fake.client as unknown as SupabaseClient,
    getValidSession: (async (uid: string) => {
      sessionCalls.push(uid);
      if (opts.session === "throws") throw new Error("vault down");
      return opts.session === "none" ? null : { accessToken: `tok-${uid}`, expiresAt: Date.now() + 3_600_000 };
    }) as QueueDeps["getValidSession"],
    buildContext: async (row) => {
      contextCalls.push(String(row.batch_id));
      return opts.context ? opts.context(row) : { images: ["https://img.test/0", "https://img.test/1", "https://img.test/2"] };
    },
    warmImages: async (urls) => {
      warmCalls.push(urls);
      return opts.warm ? opts.warm(urls) : null;
    },
    makePdf: async (row) => {
      pdfCalls.push(String(row.batch_id));
      return opts.pdf ? opts.pdf(row) : { url: "https://pdf.test/send.pdf", thumbnailUrl: "https://img.test/thumb.jpg", title: "Issue 49" };
    },
    createChannelPost: async (token, p) => {
      posts.push({ ...p, token });
      const n = posts.length;
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        await new Promise((r) => setImmediate(r));
        return opts.post ? await opts.post(p, n) : { ok: true, postId: `post_${n}` };
      } finally {
        inFlight--;
      }
    },
    logDrafts: async (_uid, rows) => void logged.push(...rows),
    fakeMode: () => opts.fake === true,
  };
  return { fake, deps, posts, logged, contextCalls, warmCalls, pdfCalls, sessionCalls, maxInFlight: () => maxInFlight };
}

beforeEach(() => {
  nextId = 1;
});

describe("a post that is created", () => {
  test("a draft: status draft, Buffer's post id kept, caption erased", async () => {
    const t = setup();
    t.fake.add(makeRow({ caption: "my caption" }));
    assert.equal(await processQueue({}, t.deps), 1);
    const r = t.fake.byId(1);
    assert.equal(r.status, "draft");
    assert.equal(r.post_id, "post_1");
    assert.equal(r.slides, 3);
    assert.equal(r.caption, null, "the caption is only needed until the post exists");
    assert.equal(r.lease_until, null);
    assert.equal(r.error, null);
    assert.deepEqual(t.posts[0].text, "my caption");
    assert.equal(t.posts[0].intent, "draft");
    assert.equal(t.posts[0].token, "tok-u1");
    assert.deepEqual(t.logged, [{ service: "linkedin", ok: true, mode: "draft" }]);
  });

  test("a publish-now: status sending (Buffer is still sending it), caption erased", async () => {
    const t = setup();
    t.fake.add(makeRow({ mode: "now", caption: "live!" }));
    await processQueue({}, t.deps);
    const r = t.fake.byId(1);
    assert.equal(r.status, "sending");
    assert.equal(r.post_id, "post_1");
    assert.equal(r.caption, null);
    assert.equal(t.posts[0].intent, "now");
  });

  test("slides are cut to the network's carousel limit", async () => {
    // 25 slides: more than any network takes, so each is cut to its own limit (LinkedIn takes 20, X takes 4).
    const t = setup({ context: () => ({ images: Array.from({ length: 25 }, (_, i) => `https://img.test/${i}`) }) });
    t.fake.add(makeRow({ service: "twitter", channel_id: "x" }), makeRow({ service: "linkedin", channel_id: "l" }));
    await processQueue({}, t.deps);
    assert.equal(t.posts.find((p) => p.service === "twitter")!.images.length, imageLimit("twitter"));
    assert.equal(t.posts.find((p) => p.service === "linkedin")!.images.length, imageLimit("linkedin"));
  });

  test("a draft over its network's limit is saved, with a note to fix it in Buffer", async () => {
    const t = setup();
    t.fake.add(makeRow({ service: "linkedin", caption: "x".repeat(4000) }));
    await processQueue({}, t.deps);
    const r = t.fake.byId(1);
    assert.equal(r.status, "draft");
    assert.match(String(r.error), /Over LinkedIn's limit/);
  });

  test("a later-created post never gets the earlier row's id", async () => {
    const t = setup();
    t.fake.add(makeRow({ channel_id: "a" }), makeRow({ channel_id: "b" }), makeRow({ channel_id: "c" }));
    await processQueue({}, t.deps);
    const ids = [1, 2, 3].map((i) => t.fake.byId(i).post_id);
    assert.equal(new Set(ids).size, 3);
  });
});

describe("Buffer says 429: nothing was created, so wait and try again", () => {
  test("the row goes back in line with a delay, keeping its caption, and is not failed", async () => {
    const t = setup({ post: () => ({ ok: false, error: "slow down", rateLimited: true }) });
    t.fake.add(makeRow({ caption: "keep me" }));
    const before = Date.now();
    await processQueue({}, t.deps);
    const r = t.fake.byId(1);
    assert.equal(r.status, "queued");
    assert.equal(r.caption, "keep me");
    assert.equal(r.lease_until, null);
    assert.notEqual(r.error, "slow down");
    const wait = (Date.parse(String(r.not_before)) - before) / 1000;
    assert.ok(wait >= 19 && wait <= 22, `first wait is about 20 s, got ${wait}`);
  });

  test("the wait doubles with each attempt: 20, 40, 80, 160, 300 seconds", async () => {
    const expected: Record<number, number> = { 0: 20, 1: 40, 2: 80, 3: 160, 4: 300 }; // attempts before this claim -> wait
    for (const [before, wait] of Object.entries(expected)) {
      const t = setup({ post: () => ({ ok: false, error: "429", rateLimited: true }) });
      t.fake.add(makeRow({ attempts: Number(before) }));
      const start = Date.now();
      await processQueue({}, t.deps);
      const r = t.fake.rows[0];
      assert.equal(r.status, "queued", `attempt ${Number(before) + 1} still retries`);
      const got = (Date.parse(String(r.not_before)) - start) / 1000;
      assert.ok(Math.abs(got - wait) < 3, `after ${Number(before) + 1} tries: wait ${wait} s, got ${got}`);
    }
  });

  test("after 6 tries it gives up and fails, with Buffer's reason", async () => {
    const t = setup({ post: () => ({ ok: false, error: "Buffer is limiting requests", rateLimited: true }) });
    t.fake.add(makeRow({ attempts: 5, caption: "still here" }));
    await processQueue({}, t.deps);
    const r = t.fake.byId(1);
    assert.equal(r.status, "failed");
    assert.equal(r.error, "Buffer is limiting requests");
    assert.equal(r.caption, "still here", "a failed row keeps its caption so Retry has something to send");
  });

  test("a delayed row is not picked up again until its time", async () => {
    const t = setup({ post: () => ({ ok: false, error: "429", rateLimited: true }) });
    t.fake.add(makeRow());
    await processQueue({}, t.deps);
    const calls = t.posts.length;
    assert.equal(await processQueue({}, t.deps), 0);
    assert.equal(t.posts.length, calls, "no second request while it waits");
  });

  test("the whole run slows down: rows not reached go back unharmed, with no attempt used", async () => {
    const t = setup({ post: () => ({ ok: false, error: "429", rateLimited: true }) });
    t.fake.add(...Array.from({ length: 6 }, (_, i) => makeRow({ channel_id: `c${i}` })));
    await processQueue({}, t.deps);
    assert.ok(t.posts.length <= 2, `at most the two in flight reached Buffer, got ${t.posts.length}`);
    const untouched = t.fake.rows.filter((r) => r.attempts === 0 && r.status === "queued");
    assert.ok(untouched.length >= 4, "the rest wait with attempts reset");
    assert.equal(t.fake.rows.filter((r) => r.status === "failed").length, 0);
    assert.equal(t.fake.rows.filter((r) => r.status === "working").length, 0, "nothing is left claimed");
  });

  test("when the limit clears the same row is sent, once", async () => {
    let n = 0;
    const t = setup({ post: () => (++n === 1 ? { ok: false, error: "429", rateLimited: true } : { ok: true, postId: "post_ok" }) });
    t.fake.add(makeRow({ caption: "retry me" }));
    await processQueue({}, t.deps);
    t.fake.byId(1).not_before = new Date(Date.now() - 1000).toISOString(); // time passes
    await processQueue({}, t.deps);
    const r = t.fake.byId(1);
    assert.equal(r.status, "draft");
    assert.equal(r.post_id, "post_ok");
    assert.equal(t.posts.length, 2);
  });
});

describe("never twice", () => {
  test("an unclear publish is marked unknown, keeps its caption, and is never sent again", async () => {
    const t = setup({ post: () => ({ ok: false, error: "the request timed out", unknown: true }) });
    t.fake.add(makeRow({ mode: "now", caption: "maybe live" }));
    await processQueue({}, t.deps);
    const r = t.fake.byId(1);
    assert.equal(r.status, "unknown");
    assert.equal(r.caption, "maybe live", "kept for 'Send again', after the person has checked Buffer");
    assert.equal(r.error, "the request timed out");
    assert.equal(r.post_id, null);
    for (let i = 0; i < 3; i++) assert.equal(await processQueue({}, t.deps), 0);
    assert.equal(t.posts.length, 1, "Buffer was asked exactly once");
  });

  test("an unclear publish is not logged as a success", async () => {
    const t = setup({ post: () => ({ ok: false, error: "timeout", unknown: true }) });
    t.fake.add(makeRow({ mode: "now" }));
    await processQueue({}, t.deps);
    assert.deepEqual(t.logged, [{ service: "linkedin", ok: false, error: "timeout", mode: "now" }]);
  });

  test("a plain refusal fails the row, keeps its caption, and is not retried", async () => {
    const t = setup({ post: () => ({ ok: false, error: "Instagram needs an image" }) });
    t.fake.add(makeRow({ caption: "fix and resend" }));
    await processQueue({}, t.deps);
    const r = t.fake.byId(1);
    assert.equal(r.status, "failed");
    assert.equal(r.error, "Instagram needs an image");
    assert.equal(r.caption, "fix and resend");
    assert.equal(await processQueue({}, t.deps), 0);
    assert.equal(t.posts.length, 1);
  });

  test("a worker that dies mid-send leaves the row claimed, and the next claim makes it unknown, not a retry", async () => {
    const t = setup({
      post: () => {
        throw new Error("function was killed");
      },
    });
    t.fake.add(makeRow({ mode: "now", caption: "was in flight" }));
    await assert.rejects(processQueue({}, t.deps), /function was killed/);
    assert.equal(t.fake.byId(1).status, "working", "not failed, not requeued: we can't know what Buffer did");
    // the lease runs out ...
    t.fake.byId(1).lease_until = new Date(Date.now() - 1000).toISOString();
    assert.equal(await processQueue({}, t.deps), 0, "... and the row is not picked up again");
    const r = t.fake.byId(1);
    assert.equal(r.status, "unknown");
    assert.equal(r.caption, "was in flight");
    assert.match(String(r.error), /may or may not have gone out/);
    assert.equal(t.posts.length, 1);
  });

  test("two workers at once never send the same row", async () => {
    const t = setup();
    t.fake.add(...Array.from({ length: 8 }, (_, i) => makeRow({ channel_id: `c${i}` })));
    await Promise.all([processQueue({}, t.deps), processQueue({}, t.deps), processQueue({}, t.deps)]);
    const sent = t.posts.map((p) => p.channelId).sort();
    assert.equal(new Set(sent).size, sent.length, "no channel was sent twice");
    assert.equal(sent.length, 8, "and every row went out");
  });

  test("a finished row is not touched by a late update from a slower worker", async () => {
    const t = setup();
    t.fake.add(makeRow());
    await processQueue({}, t.deps);
    assert.ok(t.fake.updates.length > 0);
    for (const u of t.fake.updates) {
      const status = u.filters.find(([c]) => c === "status");
      assert.deepEqual(status, ["status", "eq", "working"], "every update is guarded on the row still being 'working'");
    }
  });
});

describe("a send that can't start", () => {
  test("login expired: every row fails with the reason, nothing is sent", async () => {
    const t = setup({ session: "none" });
    t.fake.add(makeRow({ channel_id: "a" }), makeRow({ channel_id: "b" }));
    await processQueue({}, t.deps);
    for (const id of [1, 2]) {
      const r = t.fake.byId(id);
      assert.equal(r.status, "failed");
      assert.match(String(r.error), /Buffer login expired/);
      assert.equal(r.caption, "Hello", "kept, so Send again works after logging in");
    }
    assert.equal(t.posts.length, 0);
  });

  test("the session service being down is treated as an expired login, not a crash", async () => {
    const t = setup({ session: "throws" });
    t.fake.add(makeRow());
    await processQueue({}, t.deps);
    assert.equal(t.fake.byId(1).status, "failed");
    assert.equal(t.posts.length, 0);
  });

  test("a slide that can't be drawn: every channel of that send fails with the reason, once looked up", async () => {
    const t = setup({ context: () => ({ problem: "Couldn't draw slide 2, so nothing was sent. Go back to Design and try again." }) });
    t.fake.add(makeRow({ channel_id: "a" }), makeRow({ channel_id: "b" }), makeRow({ channel_id: "c" }));
    await processQueue({}, t.deps);
    assert.deepEqual(t.fake.rows.map((r) => r.status), ["failed", "failed", "failed"]);
    assert.match(String(t.fake.byId(1).error), /Couldn't draw slide 2/);
    assert.equal(t.posts.length, 0, "nothing half-finished reached Buffer");
    assert.equal(t.contextCalls.length, 1, "the slides were checked once for the whole send, not per channel");
  });

  test("each send (batch) builds its own context; one send's problem doesn't fail another", async () => {
    const t = setup({ context: (row) => (row.batch_id === "bad" ? { problem: "broken" } : { images: ["https://img.test/0"] }) });
    t.fake.add(makeRow({ batch_id: "bad" }), makeRow({ batch_id: "good", channel_id: "g" }));
    await processQueue({}, t.deps);
    assert.equal(t.fake.byId(1).status, "failed");
    assert.equal(t.fake.byId(2).status, "draft");
    assert.deepEqual([...t.contextCalls].sort(), ["bad", "good"]);
  });

  test("a long reason is clipped to fit the row", async () => {
    const t = setup({ context: () => ({ problem: "x".repeat(1000) }) });
    t.fake.add(makeRow());
    await processQueue({}, t.deps);
    assert.ok(String(t.fake.byId(1).error).length <= 200);
  });
});

describe("how much work one run does", () => {
  test("at most two posts are created at a time", async () => {
    const t = setup();
    t.fake.add(...Array.from({ length: 6 }, (_, i) => makeRow({ channel_id: `c${i}` })));
    await processQueue({}, t.deps);
    assert.equal(t.posts.length, 6);
    assert.ok(t.maxInFlight() <= 2, `in flight: ${t.maxInFlight()}`);
  });

  test("a run claims at most `limit` rows", async () => {
    const t = setup();
    t.fake.add(...Array.from({ length: 5 }, (_, i) => makeRow({ channel_id: `c${i}` })));
    assert.equal(await processQueue({ limit: 2 }, t.deps), 2);
    assert.equal(t.fake.rows.filter((r) => r.status === "queued").length, 3);
  });

  test("out of time: nothing is sent and every claimed row goes back with its attempt unused", async () => {
    const t = setup();
    t.fake.add(makeRow({ channel_id: "a" }), makeRow({ channel_id: "b" }));
    assert.equal(await processQueue({ deadlineMs: -1 }, t.deps), 0);
    assert.equal(t.posts.length, 0);
    assert.deepEqual(t.fake.rows.map((r) => [r.status, r.attempts]), [["queued", 0], ["queued", 0]]);
  });

  test("only the asked user's rows are worked, and each user's own token is used", async () => {
    const t = setup();
    t.fake.add(makeRow({ user_id: "u1", channel_id: "a" }), makeRow({ user_id: "u2", channel_id: "b" }));
    await processQueue({ userId: "u2" }, t.deps);
    assert.equal(t.fake.byId(1).status, "queued");
    assert.equal(t.fake.byId(2).status, "draft");
    assert.equal(t.posts[0].token, "tok-u2");

    await processQueue({}, t.deps); // no user: anyone's
    assert.equal(t.fake.byId(1).status, "draft");
    assert.equal(t.posts[1].token, "tok-u1");
  });

  test("the login is looked up once per user per run, not once per channel", async () => {
    const t = setup();
    t.fake.add(...Array.from({ length: 4 }, (_, i) => makeRow({ channel_id: `c${i}` })));
    await processQueue({}, t.deps);
    assert.equal(t.sessionCalls.length, 1);
  });

  test("an empty queue is a quiet no-op", async () => {
    const t = setup();
    assert.equal(await processQueue({}, t.deps), 0);
    assert.equal(t.posts.length, 0);
  });
});

describe("enqueue: writing the rows", () => {
  const request = (channels: QueueRequest["channels"], over: Partial<QueueRequest> = {}): QueueRequest => ({
    source: "own:pub_x:post_y",
    picks: [3, 1, 2],
    template: "style=a&font=b",
    intent: "draft",
    newsletter: "Just a Phase",
    issueTitle: "Issue 49",
    channels,
    ...over,
  });

  test("one queued row per channel, all in one batch, with the picks, template and caption", async () => {
    const fake = new FakeDb();
    const { batchId } = await enqueue(
      "u1",
      request([
        { id: "ch-a", service: "LinkedIn", name: "My Page", caption: "Hi LinkedIn" },
        { id: "ch-b", service: "instagram", name: "My Insta", caption: "Hi Insta" },
      ]),
      fake.client as unknown as SupabaseClient,
    );
    assert.equal(fake.rows.length, 2);
    for (const r of fake.rows) {
      assert.equal(r.status, "queued");
      assert.equal(r.batch_id, batchId);
      assert.equal(r.user_id, "u1");
      assert.deepEqual(r.picks, [3, 1, 2]);
      assert.equal(r.template, "style=a&font=b");
      assert.equal(r.source, "own:pub_x:post_y");
      assert.equal(r.mode, "draft");
    }
    assert.deepEqual(fake.rows.map((r) => [r.service, r.caption]), [["linkedin", "Hi LinkedIn"], ["instagram", "Hi Insta"]]);
  });

  test("a network that can't take a carousel is failed at once, with its reason and no caption", async () => {
    const fake = new FakeDb();
    await enqueue("u1", request([{ id: "t", service: "tiktok", name: "TT", caption: "nope" }, { id: "l", service: "linkedin", name: "LI", caption: "yes" }]), fake.client as unknown as SupabaseClient);
    const tiktok = fake.rows.find((r) => r.service === "tiktok")!;
    assert.equal(tiktok.status, "failed");
    assert.equal(tiktok.error, "Needs video");
    assert.equal(tiktok.caption, undefined);
    assert.equal(fake.rows.find((r) => r.service === "linkedin")!.status, "queued");
    // ... and the worker never touches the failed one
    const t = setup();
    t.fake.rows = fake.rows;
    await processQueue({}, t.deps);
    assert.deepEqual(t.posts.map((p) => p.service), ["linkedin"]);
  });

  test("a channel can override the batch's intent (a too-long caption is saved as a draft)", async () => {
    const fake = new FakeDb();
    await enqueue(
      "u1",
      request([{ id: "a", service: "linkedin", name: "A", caption: "x" }, { id: "b", service: "linkedin", name: "B", caption: "y", intent: "draft" }], { intent: "now" }),
      fake.client as unknown as SupabaseClient,
    );
    assert.deepEqual(fake.rows.map((r) => r.mode), ["now", "draft"]);
  });

  test("oversized input is cut to what the table accepts", async () => {
    const fake = new FakeDb();
    await enqueue("u1", request([{ id: "i".repeat(500), service: "linkedin", name: "n".repeat(500), caption: "c".repeat(20_000) }], { issueTitle: "t".repeat(500), newsletter: "s".repeat(500) }), fake.client as unknown as SupabaseClient);
    const r = fake.rows[0];
    assert.equal(r.channel_id.length, 100);
    assert.equal(String(r.caption).length, 10_000);
    assert.ok(String(r.channel_name).length <= 120);
    assert.ok(String(r.issue_title).length <= 200);
    assert.ok(String(r.newsletter).length <= 120);
  });

  test("the send's title is written on every row, and left off when there is none", async () => {
    const fake = new FakeDb();
    await enqueue("u1", request([{ id: "a", service: "instagram", name: "A", caption: "c" }, { id: "b", service: "linkedin", name: "B", caption: "c" }], { postTitle: "Baby Rhyme Time" }), fake.client as unknown as SupabaseClient);
    assert.deepEqual(fake.rows.map((r) => r.post_title), ["Baby Rhyme Time", "Baby Rhyme Time"]);
    const bare = new FakeDb();
    await enqueue("u1", request([{ id: "a", service: "instagram", name: "A", caption: "c" }]), bare.client as unknown as SupabaseClient);
    assert.equal("post_title" in bare.rows[0], false);
  });

  test("a database without the post_title column yet: the send is queued without it", async () => {
    const fake = new FakeDb();
    fake.missingColumns = ["post_title"];
    await enqueue("u1", request([{ id: "a", service: "instagram", name: "A", caption: "c" }], { postTitle: "Baby Rhyme Time" }), fake.client as unknown as SupabaseClient);
    assert.equal(fake.rows.length, 1);
    assert.equal("post_title" in fake.rows[0], false);
    assert.equal(fake.rows[0].status, "queued");
  });

  test("if the rows can't be written the send fails loudly, so nothing is silently lost", async () => {
    const fake = new FakeDb();
    fake.insertError = "connection refused";
    await assert.rejects(enqueue("u1", request([{ id: "a", service: "linkedin", name: "A", caption: "x" }]), fake.client as unknown as SupabaseClient), /Could not queue the send: connection refused/);
  });
});

describe("networks that refuse large images (Bluesky) get the small JPEG slides", () => {
  const both = (): Context => ({ images: ["https://img.test/png0", "https://img.test/png1"], smallImages: ["https://img.test/jpg0", "https://img.test/jpg1"] });
  const rows = (t: ReturnType<typeof setup>, ...services: string[]) => services.forEach((service, i) => t.fake.add(makeRow({ service, channel_id: `c${i}`, batch_id: "b1" })));

  test("Bluesky posts the JPEG set; every other network keeps the full-size set", async () => {
    const t = setup({ context: both });
    rows(t, "linkedin", "bluesky", "instagram");
    await processQueue({}, t.deps);
    const by = (svc: string) => t.posts.find((p) => p.service === svc)!.images;
    assert.deepEqual(by("bluesky"), ["https://img.test/jpg0", "https://img.test/jpg1"]);
    assert.deepEqual(by("linkedin"), ["https://img.test/png0", "https://img.test/png1"]);
    assert.deepEqual(by("instagram"), ["https://img.test/png0", "https://img.test/png1"]);
  });
  test("the JPEG slides are drawn ahead once per send, however many Bluesky channels", async () => {
    const t = setup({ context: both });
    rows(t, "bluesky", "bluesky", "bluesky");
    await processQueue({}, t.deps);
    assert.equal(t.warmCalls.length, 1);
    assert.deepEqual(t.warmCalls[0], ["https://img.test/jpg0", "https://img.test/jpg1"]);
  });
  test("a send with no Bluesky channel draws nothing extra", async () => {
    const t = setup({ context: both });
    rows(t, "linkedin", "instagram", "threads");
    await processQueue({}, t.deps);
    assert.equal(t.warmCalls.length, 0);
  });
  test("if the JPEG slides can't be drawn only the Bluesky posts fail, with the reason; the others still go", async () => {
    const t = setup({ context: both, warm: () => "Couldn't draw slide 2, so nothing was sent. Go back to Design and try again." });
    rows(t, "linkedin", "bluesky");
    await processQueue({}, t.deps);
    assert.equal(t.posts.length, 1);
    assert.equal(t.posts[0].service, "linkedin");
    const bsky = t.fake.rows.find((r) => r.service === "bluesky")!;
    assert.equal(bsky.status, "failed");
    assert.match(String(bsky.error), /Couldn't draw slide 2/);
  });
  test("fake mode posts nothing real and draws nothing, but still takes the JPEG set", async () => {
    const t = setup({ context: both, fake: true });
    rows(t, "bluesky");
    await processQueue({}, t.deps);
    assert.equal(t.warmCalls.length, 0);
    assert.deepEqual(t.posts[0].images, ["https://img.test/jpg0", "https://img.test/jpg1"]);
  });
  test("a context without a JPEG set (nothing to draw it from) falls back to the normal slides", async () => {
    const t = setup();
    rows(t, "bluesky");
    await processQueue({}, t.deps);
    assert.equal(t.warmCalls.length, 0);
    assert.deepEqual(t.posts[0].images, ["https://img.test/0", "https://img.test/1", "https://img.test/2"]);
  });
  test("the network's own image limit still applies (Bluesky: 4)", async () => {
    const t = setup({ context: () => ({ images: Array.from({ length: 9 }, (_, i) => `p${i}`), smallImages: Array.from({ length: 9 }, (_, i) => `j${i}`) }) });
    rows(t, "bluesky");
    await processQueue({}, t.deps);
    assert.deepEqual(t.posts[0].images, ["j0", "j1", "j2", "j3"]);
  });
});


describe("alt text goes with the slides", () => {
  const ctx = { images: ["https://img.test/0", "https://img.test/1", "https://img.test/2", "https://img.test/3", "https://img.test/4", "https://img.test/5"], alts: ["a0", "a1", "a2", "a3", "a4", "a5"] };

  test("each network gets the alt text of the slides it is sent", async () => {
    const t = setup({ context: () => ctx });
    t.fake.add(makeRow({ service: "instagram" }), makeRow({ service: "twitter" }));
    await processQueue({}, t.deps);
    assert.deepEqual(t.posts.find((p) => p.service === "instagram")!.alts, ctx.alts);
    // A network that takes 4 slides is sent the first 4 alt texts, not a list longer than its images.
    assert.deepEqual(t.posts.find((p) => p.service === "twitter")!.alts, ctx.alts.slice(0, 4));
  });
  test("a send without alt text (rows from before it existed) is sent as before", async () => {
    const t = setup({ context: () => ({ images: ctx.images }) });
    t.fake.add(makeRow({ service: "instagram" }));
    await processQueue({}, t.deps);
    assert.equal(t.posts[0].alts, undefined);
  });
  test("a network that refused the alt text still gets the post, and the row says so", async () => {
    const t = setup({ context: () => ctx, post: () => ({ ok: true, postId: "p1", altDropped: true }) });
    t.fake.add(makeRow({ service: "mastodon" }));
    await processQueue({}, t.deps);
    const row = t.fake.rows[0];
    assert.equal(row.status, "draft");
    assert.match(String(row.error), /Mastodon didn't take the alt text/);
  });
});

describe("LinkedIn as a PDF", () => {
  const ctx = { images: Array.from({ length: 25 }, (_, i) => `https://img.test/${i}`), alts: Array.from({ length: 25 }, (_, i) => `alt ${i}`) };

  test("a LinkedIn row that asked for it is sent one document: every slide, not just the first 20", async () => {
    const t = setup({ context: () => ctx });
    t.fake.add(makeRow({ service: "linkedin", as_pdf: true }));
    await processQueue({}, t.deps);
    assert.equal(t.posts.length, 1);
    assert.deepEqual(t.posts[0].document, { url: "https://pdf.test/send.pdf", thumbnailUrl: "https://img.test/thumb.jpg", title: "Issue 49" });
    assert.equal(t.fake.rows[0].slides, 25);
    assert.equal(t.fake.rows[0].status, "draft");
  });
  test("a LinkedIn row that did not ask for it is sent images, cut to LinkedIn's 20", async () => {
    const t = setup({ context: () => ctx });
    t.fake.add(makeRow({ service: "linkedin" }));
    await processQueue({}, t.deps);
    assert.equal(t.posts[0].document, undefined);
    assert.equal(t.posts[0].images.length, 20);
    assert.equal(t.pdfCalls.length, 0, "no PDF was made");
  });
  test("another network is never sent the PDF, whatever the row says", async () => {
    const t = setup({ context: () => ctx });
    t.fake.add(makeRow({ service: "instagram", as_pdf: true }));
    await processQueue({}, t.deps);
    assert.equal(t.posts[0].document, undefined);
    assert.equal(t.pdfCalls.length, 0);
  });
  test("two LinkedIn channels of one send share one PDF", async () => {
    const t = setup({ context: () => ctx });
    t.fake.add(makeRow({ service: "linkedin", as_pdf: true, channel_id: "a" }), makeRow({ service: "linkedin", as_pdf: true, channel_id: "b" }));
    await processQueue({}, t.deps);
    assert.equal(t.pdfCalls.length, 1);
    assert.equal(t.posts.filter((p) => p.document).length, 2);
  });
  test("a PDF that can't be made: LinkedIn gets the slides as images instead", async () => {
    const t = setup({ context: () => ctx, pdf: () => null });
    t.fake.add(makeRow({ service: "linkedin", as_pdf: true }));
    await processQueue({}, t.deps);
    assert.equal(t.posts.length, 1);
    assert.equal(t.posts[0].document, undefined);
    assert.equal(t.posts[0].images.length, 20);
  });
  test("a plain refusal of the PDF: the same post goes again as images, once, and the row says what happened", async () => {
    const t = setup({ context: () => ctx, post: (p) => (p.document ? { ok: false, error: "Document posts are not supported for this channel." } : { ok: true, postId: "p1" }) });
    t.fake.add(makeRow({ service: "linkedin", as_pdf: true }));
    await processQueue({}, t.deps);
    assert.equal(t.posts.length, 2);
    assert.ok(t.posts[0].document);
    assert.equal(t.posts[1].document, undefined);
    const row = t.fake.rows[0];
    assert.equal(row.status, "draft");
    assert.equal(row.post_id, "p1");
    assert.match(String(row.error), /didn't take the PDF .*Document posts are not supported.*went as images/);
  });
  test("an unclear outcome is never sent again as images: the post may exist, and a second one would be a duplicate", async () => {
    const t = setup({ context: () => ctx, post: () => ({ ok: false, error: "timed out", unknown: true }) });
    t.fake.add(makeRow({ service: "linkedin", as_pdf: true, mode: "now" }));
    await processQueue({}, t.deps);
    assert.equal(t.posts.length, 1);
    assert.equal(t.fake.rows[0].status, "unknown");
  });
  test("Buffer's 429 on the PDF waits and tries the PDF again later; it does not fall back", async () => {
    const t = setup({ context: () => ctx, post: () => ({ ok: false, error: "limit", rateLimited: true }) });
    t.fake.add(makeRow({ service: "linkedin", as_pdf: true }));
    await processQueue({}, t.deps);
    assert.equal(t.posts.length, 1);
    assert.equal(t.fake.rows[0].status, "queued");
    assert.ok(t.fake.rows[0].not_before);
  });
  test("a refusal that also fails as images is a plain failure, with the second reason", async () => {
    const t = setup({ context: () => ctx, post: (p) => ({ ok: false, error: p.document ? "no documents" : "channel is locked" }) });
    t.fake.add(makeRow({ service: "linkedin", as_pdf: true }));
    await processQueue({}, t.deps);
    assert.equal(t.fake.rows[0].status, "failed");
    assert.equal(t.fake.rows[0].error, "channel is locked");
  });
});

describe("enqueue: the LinkedIn PDF choice", () => {
  const request = (over: Partial<QueueRequest> = {}): QueueRequest => ({
    source: "link:abc",
    picks: [1],
    template: "",
    intent: "draft",
    newsletter: "N",
    issueTitle: "T",
    channels: [
      { id: "l", service: "LinkedIn", name: "L", caption: "c" },
      { id: "i", service: "Instagram", name: "I", caption: "c" },
    ],
    ...over,
  });
  test("asked for: only the LinkedIn rows carry it", async () => {
    const fake = new FakeDb();
    await enqueue("u1", request({ linkedinPdf: true }), fake.client as unknown as SupabaseClient);
    assert.equal(fake.rows.find((r) => r.service === "linkedin")!.as_pdf, true);
    assert.equal("as_pdf" in fake.rows.find((r) => r.service === "instagram")!, false);
  });
  test("a database without the as_pdf column yet: LinkedIn is queued as images instead of the send failing", async () => {
    const fake = new FakeDb();
    fake.missingColumns = ["as_pdf"];
    const { batchId } = await enqueue("u1", request({ linkedinPdf: true }), fake.client as unknown as SupabaseClient);
    assert.ok(batchId);
    assert.equal(fake.rows.length, 2);
    assert.ok(fake.rows.every((r) => !("as_pdf" in r)));
    assert.equal(fake.rows.find((r) => r.service === "linkedin")!.status, "queued");
  });
  test("any other database error still fails the send", async () => {
    const fake = new FakeDb();
    fake.insertError = "connection refused";
    await assert.rejects(enqueue("u1", request({ linkedinPdf: true }), fake.client as unknown as SupabaseClient), /Could not queue the send: connection refused/);
  });
  test("not asked for: no row has the column at all, so a database without it keeps working", async () => {
    const fake = new FakeDb();
    await enqueue("u1", request(), fake.client as unknown as SupabaseClient);
    assert.ok(fake.rows.every((r) => !("as_pdf" in r)));
  });
});
