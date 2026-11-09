// Test-only. Never imported by the app. A fake network for tests that touch Buffer or Supabase:
//   - Supabase (http://db.test): the connections / users tables and the functions connections.ts calls, in memory;
//   - Buffer's sign-in server (auth.buffer.com/token): refresh tokens are SINGLE USE, and reusing one revokes the whole grant, as Buffer does;
//   - Buffer's GraphQL API (api.buffer.com): a handler the test supplies.
// Anything else that tries to reach the network fails the test, so a stray real call can't hide.

export type Json = Record<string, unknown>;

type Connection = { secret: string | null; last4: string | null; meta: Json; status: string; leaseHeld: boolean };

export class FakeSupabase {
  connections = new Map<string, Connection>();
  users = new Map<string, string>(); // buffer_user_id -> id
  brandProfiles = new Set<string>();
  /** Every rpc call, in order: the order matters (a rotated token must be saved BEFORE the lease is released). */
  calls: { name: string; args: Json }[] = [];
  /** Make one function fail: { status: 500, message: "boom" }. */
  failRpc: Record<string, { status: number; message: string }> = {};
  failTable: Record<string, { status: number; message: string }> = {};
  /** Runs just before a function answers: lets a test make something happen "at that moment" (another request rotating the tokens, say). */
  beforeRpc: ((name: string, args: Json) => void) | null = null;
  private nextUser = 1;

  private key = (u: unknown, p: unknown) => `${u}:${p}`;
  conn = (user: string, provider: string) => this.connections.get(this.key(user, provider));

  /** Seed a saved Buffer session the way saveBufferSession stores it. */
  seedSession(user: string, session: { accessToken: string; refreshToken?: string; expiresAt: number }) {
    this.connections.set(this.key(user, "buffer"), { secret: JSON.stringify(session), last4: null, meta: {}, status: "active", leaseHeld: false });
  }
  storedSession(user: string) {
    const s = this.conn(user, "buffer")?.secret;
    return s ? (JSON.parse(s) as { accessToken: string; refreshToken?: string; expiresAt: number }) : null;
  }


  /** Any table the specific handlers below don't cover (current_runs, saved_creations, custom_picks, ...): a small PostgREST in memory. */
  tables = new Map<string, Json[]>();
  private serial = new Map<string, number>();
  rows = (table: string): Json[] => {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  };
  private static UUID_TABLES = new Set(["saved_creations"]);
  private newId(table: string): string | number {
    if (FakeSupabase.UUID_TABLES.has(table)) {
      const n = (this.serial.get(table) ?? 0) + 1;
      this.serial.set(table, n);
      return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    }
    const n = (this.serial.get(table) ?? 0) + 1;
    this.serial.set(table, n);
    return n;
  }

  private matcher(url: URL): (row: Json) => boolean {
    const reserved = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);
    const list = (v: string) => v.replace(/^\(/, "").replace(/\)$/, "").split(",").map((x) => x.replace(/^"|"$/g, ""));
    // One PostgREST condition, e.g. "eq.now", "not.in.(a,b)", "is.null", "lt.2026-01-01". An operator this fake does not know THROWS: matching
    // everything silently would make a test of a filter pass for the wrong reason.
    const cond = (col: string, raw: string): ((r: Json) => boolean) => {
      if (raw.startsWith("not.")) {
        const inner = cond(col, raw.slice(4));
        return (r) => !inner(r);
      }
      const dot = raw.indexOf(".");
      const op = dot < 0 ? raw : raw.slice(0, dot);
      const val = dot < 0 ? "" : raw.slice(dot + 1);
      const num = (r: Json) => (typeof r[col] === "number" ? (r[col] as number) : NaN);
      const cmp = (r: Json, f: (a: number | string, b: number | string) => boolean) => {
        const v = r[col];
        if (v === null || v === undefined) return false;
        return typeof v === "number" ? f(v, Number(val)) : f(String(v), val);
      };
      void num;
      switch (op) {
        case "eq": return (r) => String(r[col]) === val;
        case "neq": return (r) => String(r[col]) !== val;
        case "in": return (r) => list(val).includes(String(r[col]));
        case "is": return val === "null" ? (r) => r[col] === null || r[col] === undefined : (() => { throw new Error(`fake supabase: unsupported "is.${val}"`); })();
        case "lt": return (r) => cmp(r, (a, b) => a < b);
        case "lte": return (r) => cmp(r, (a, b) => a <= b);
        case "gt": return (r) => cmp(r, (a, b) => a > b);
        case "gte": return (r) => cmp(r, (a, b) => a >= b);
        default: throw new Error(`fake supabase: unsupported filter "${col}=${raw}"`);
      }
    };
    const tests: ((r: Json) => boolean)[] = [];
    for (const [col, raw] of url.searchParams) {
      if (reserved.has(col)) continue;
      if (col === "or") {
        // or=(mode.eq.now,status.eq.unknown): top-level commas separate the alternatives (none of ours nest or hold commas in a value).
        const alts = raw.replace(/^\(/, "").replace(/\)$/, "").split(/,(?=[a-z_]+\.)/).map((a) => {
          const i = a.indexOf(".");
          return cond(a.slice(0, i), a.slice(i + 1));
        });
        tests.push((r) => alts.some((t) => t(r)));
        continue;
      }
      tests.push(cond(col, raw));
    }
    return (r) => tests.every((t) => t(r));
  }

  private project(row: Json, url: URL): Json {
    const sel = url.searchParams.get("select");
    if (!sel || sel === "*" || sel.includes("(")) return { ...row };
    const out: Json = {};
    for (const c of sel.split(",").map((x) => x.trim())) if (c in row) out[c] = row[c];
    return out;
  }

  private generic(table: string, method: string, url: URL, init: RequestInit, body: unknown): Response {
    const headers = new Headers(init.headers);
    const prefer = headers.get("prefer") ?? "";
    const wantsObject = (headers.get("accept") ?? "").includes("vnd.pgrst.object");
    const wantsRows = prefer.includes("return=representation");
    const match = this.matcher(url);
    const out = (rows: Json[], status = 200) => {
      const shaped = rows.map((r) => this.project(r, url));
      if (wantsObject) return shaped.length === 1 ? this.respond(shaped[0], status) : this.respond({ message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" }, 406);
      return this.respond(shaped, status);
    };

    if (method === "HEAD" || (method === "GET" && prefer.includes("count=exact") && url.searchParams.get("select") && init.method === "HEAD")) {
      const n = this.rows(table).filter(match).length;
      return new Response(null, { status: 200, headers: { "Content-Range": `*/${n}` } });
    }
    if (method === "GET") {
      let rows = this.rows(table).filter(match);
      const order = url.searchParams.get("order");
      if (order) {
        // order=created_at.desc,id.desc : several columns, each with its own direction; numbers compare as numbers.
        const keys = order.split(",").map((o) => {
          const [col, dir] = o.split(".");
          return { col, sign: dir === "desc" ? -1 : 1 };
        });
        const cmp = (x: unknown, y: unknown) => (typeof x === "number" && typeof y === "number" ? x - y : String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0);
        rows = [...rows].sort((a, b) => {
          for (const k of keys) {
            const c = cmp(a[k.col], b[k.col]) * k.sign;
            if (c !== 0) return c;
          }
          return 0;
        });
      }
      const limit = Number(url.searchParams.get("limit"));
      if (limit > 0) rows = rows.slice(0, limit);
      return out(rows);
    }
    if (method === "POST") {
      const incoming = (Array.isArray(body) ? body : [body]) as Json[];
      const conflict = url.searchParams.get("on_conflict")?.split(",");
      const done: Json[] = [];
      for (const r of incoming) {
        const existing = conflict && prefer.includes("merge-duplicates") ? this.rows(table).find((x) => conflict.every((c) => String(x[c]) === String(r[c]))) : undefined;
        if (existing) {
          Object.assign(existing, r);
          done.push(existing);
        } else {
          const row = { ...r };
          if (row.id === undefined && table !== "current_runs") row.id = this.newId(table);
          // Column defaults the real table has (db/supabase/0015, 0016).
          if (table === "post_history") {
            row.created_at ??= new Date().toISOString();
            row.attempts ??= 0;
          }
          this.rows(table).push(row);
          done.push(row);
        }
      }
      return wantsRows ? out(done, 201) : this.respond(undefined, 201);
    }
    if (method === "PATCH") {
      const rows = this.rows(table).filter(match);
      for (const r of rows) Object.assign(r, body as Json);
      return wantsRows ? out(rows) : this.respond(undefined, 204);
    }
    if (method === "DELETE") {
      const all = this.rows(table);
      const gone = all.filter(match);
      this.tables.set(table, all.filter((r) => !gone.includes(r)));
      return wantsRows ? out(gone) : this.respond(undefined, 204);
    }
    return this.respond({ message: `FakeSupabase: unhandled ${method} ${url.pathname}` }, 500);
  }

  private respond(body: unknown, status = 200) {
    return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }

  /** Files in the "slides" Storage bucket (src/lib/slideStore.ts), by path. */
  files = new Map<string, Uint8Array>();

  /** The three Storage calls slideStore makes: upload, list a folder, remove by path. */
  private storage(method: string, m: RegExpExecArray, init: RequestInit): Response {
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
    if (m[1] === "list") {
      const b = JSON.parse(String(init.body ?? "{}")) as { prefix?: string; limit?: number };
      const dir = (b.prefix ?? "").replace(/\/?$/, "/");
      const names = [...this.files.keys()].filter((k) => k.startsWith(dir) && !k.slice(dir.length).includes("/")).map((k) => ({ name: k.slice(dir.length), id: `file-${k}` }));
      return json(b.limit ? names.slice(0, b.limit) : names);
    }
    if (method === "DELETE") {
      const b = JSON.parse(String(init.body ?? "{}")) as { prefixes?: string[] };
      for (const p of b.prefixes ?? []) this.files.delete(p);
      return json((b.prefixes ?? []).map((name) => ({ name })));
    }
    if ((method === "POST" || method === "PUT") && m[2]) {
      const body = init.body;
      this.files.set(decodeURIComponent(m[2]), body instanceof Uint8Array ? body : new TextEncoder().encode(String(body ?? "")));
      return json({ Key: `slides/${m[2]}`, Id: "id" });
    }
    return json({ message: `fake storage: unsupported ${method} ${m[0]}` }, 400);
  }

  handle(url: URL, init: RequestInit): Response {
    const method = (init.method ?? "GET").toUpperCase();
    const storage = /\/storage\/v1\/object\/(?:(list)\/)?slides(?:\/(.+))?$/.exec(url.pathname);
    if (storage) return this.storage(method, storage, init);
    const body = typeof init.body === "string" && init.body ? (JSON.parse(init.body) as Json) : {};
    const rpc = /\/rest\/v1\/rpc\/(\w+)$/.exec(url.pathname);
    if (rpc) return this.rpc(rpc[1], body);

    const table = /\/rest\/v1\/(\w+)$/.exec(url.pathname)?.[1] ?? "";
    const fail = this.failTable[table];
    if (fail) return this.respond({ message: fail.message, code: "X" }, fail.status);
    const eq = (col: string) => url.searchParams.get(col)?.replace(/^eq\./, "");

    if (table === "connections" && method === "GET") {
      const c = this.conn(String(eq("user_id")), String(eq("provider")));
      return this.respond(c ? [{ last4: c.last4, status: c.status, meta: c.meta }] : []);
    }
    if (table === "connections" && method === "PATCH") {
      const c = this.conn(String(eq("user_id")), String(eq("provider")));
      if (c) Object.assign(c, body);
      return this.respond(undefined, 204);
    }
    if (table === "users" && method === "POST") {
      const bid = String(body.buffer_user_id);
      if (!this.users.has(bid)) this.users.set(bid, `user-${this.nextUser++}`);
      return this.respond({ id: this.users.get(bid) }, 201);
    }
    if (table === "brand_profiles" && method === "POST") {
      this.brandProfiles.add(String(body.user_id));
      return this.respond(undefined, 201);
    }
    return this.generic(table, method, url, init, body);
  }

  private rpc(name: string, args: Json): Response {
    this.calls.push({ name, args });
    this.beforeRpc?.(name, args);
    const fail = this.failRpc[name];
    if (fail) return this.respond({ message: fail.message, code: "X" }, fail.status);
    const k = this.key(args.p_user_id, args.p_provider);
    switch (name) {
      case "get_connection_secret":
        return this.respond(this.connections.get(k)?.secret ?? null);
      case "set_connection_secret": {
        const prev = this.connections.get(k);
        this.connections.set(k, {
          secret: String(args.p_secret),
          last4: (args.p_last4 as string | undefined) ?? prev?.last4 ?? null,
          meta: (args.p_meta as Json | undefined) ?? prev?.meta ?? {},
          status: "active",
          leaseHeld: prev?.leaseHeld ?? false,
        });
        return this.respond(null);
      }
      case "delete_connection":
        this.connections.delete(k);
        return this.respond(null);
      case "acquire_refresh_lease": {
        const c = this.connections.get(k);
        if (!c || c.leaseHeld) return this.respond(false);
        c.leaseHeld = true;
        return this.respond(true);
      }
      case "release_refresh_lease": {
        const c = this.connections.get(k);
        if (c) c.leaseHeld = false;
        return this.respond(null);
      }
      case "claim_queued_posts": {
        // db/supabase/0019: rows still 'working' after their lease ran out are 'unknown' (never retried); then the due 'queued' rows
        // (this user's, or anyone's when p_user_id is null) are taken oldest first, marked 'working' with a lease, and their attempts go up by one.
        const now = Date.now();
        const rows = this.rows("post_history");
        for (const r of rows) {
          if (r.status === "working" && r.lease_until && new Date(String(r.lease_until)).getTime() < now) {
            r.status = "unknown";
            r.lease_until = null;
            r.error = "This was interrupted, so it may or may not have gone out. Check Buffer before sending it again.";
          }
        }
        const due = rows
          .filter((r) => r.status === "queued" && (!r.not_before || new Date(String(r.not_before)).getTime() <= now) && (!args.p_user_id || r.user_id === args.p_user_id))
          .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) || Number(a.id) - Number(b.id))
          .slice(0, Number(args.p_limit ?? 6));
        for (const r of due) {
          r.status = "working";
          r.lease_until = new Date(now + Number(args.p_lease_seconds ?? 60) * 1000).toISOString();
          r.attempts = Number(r.attempts ?? 0) + 1;
        }
        return this.respond(due.map((r) => ({ ...r })));
      }
      default:
        return this.respond({ message: `FakeSupabase: unknown function ${name}` }, 404);
    }
  }
}

/** Buffer's sign-in server. Refresh tokens work once; reusing one kills the grant (every later refresh fails). */
export class FakeBufferAuth {
  requests: { grant: string; params: URLSearchParams }[] = [];
  private codes = new Map<string, string>(); // code -> verifier it must come with
  private valid = new Set<string>(); // refresh tokens that have not been used
  revoked = false;
  private n = 0;
  /** Seconds the access token lives (Buffer's expires_in). */
  expiresIn = 3600;
  /** Force an answer: { status: 500, body: "..." } for the next request(s). */
  force: { status: number; body: unknown } | null = null;
  /** Called before answering; lets a test hold a refresh open while others pile up. */
  beforeAnswer: (() => Promise<void>) | null = null;
  /** Leave refresh_token out of answers (a client that didn't ask for offline access). */
  omitRefreshToken = false;

  issueRefreshToken(): string {
    const t = `rt-${++this.n}`;
    this.valid.add(t);
    return t;
  }
  addCode(code: string, verifier: string) {
    this.codes.set(code, verifier);
  }
  isValid = (t: string) => this.valid.has(t);

  async handle(init: RequestInit): Promise<Response> {
    const params = new URLSearchParams(String(init.body ?? ""));
    const grant = params.get("grant_type") ?? "";
    this.requests.push({ grant, params });
    if (this.beforeAnswer) await this.beforeAnswer();
    const json = (b: unknown, s = 200) => new Response(typeof b === "string" ? b : JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
    if (this.force) return json(this.force.body, this.force.status);
    const issue = () => {
      const access = `at-${++this.n}`;
      const out: Json = { access_token: access, expires_in: this.expiresIn };
      if (!this.omitRefreshToken) out.refresh_token = this.issueRefreshToken();
      return json(out);
    };
    if (grant === "authorization_code") {
      const code = params.get("code") ?? "";
      const verifier = this.codes.get(code);
      if (verifier === undefined || verifier !== params.get("code_verifier")) return json({ error: "invalid_grant" }, 400);
      this.codes.delete(code); // an authorization code is single use too
      return issue();
    }
    if (grant === "refresh_token") {
      const rt = params.get("refresh_token") ?? "";
      if (this.revoked || !this.valid.has(rt)) {
        this.revoked = true; // reuse revokes the whole grant
        this.valid.clear();
        return json({ error: "invalid_grant", error_description: "refresh token already used" }, 400);
      }
      this.valid.delete(rt);
      return issue();
    }
    return json({ error: "unsupported_grant_type" }, 400);
  }
}

export type GraphqlHandler = (query: string, ctx: { token: string; headers: Headers }) => Response | Promise<Response>;

export type Fakes = {
  supabase: FakeSupabase;
  auth: FakeBufferAuth;
  /** Every GraphQL request: the query and the token it carried. */
  graphqlCalls: { query: string; token: string }[];
  /** What api.buffer.com answers. Defaults to a 500 so a test that forgot to set one fails loudly. */
  graphql: GraphqlHandler;
  /** Everything else that was tried. */
  strays: string[];
  reset: () => void;
  restore: () => void;
};

/**
 * Replaces globalThis.fetch ONCE (supabase-js keeps the fetch it first sees, so a test must not swap it again) and sets the env the
 * app expects. Call at the top of a test file, before anything calls db(). Use `reset()` between tests.
 */
export function installFakes(): Fakes {
  const real = globalThis.fetch;
  process.env.SUPABASE_URL = "http://db.test";
  process.env.SUPABASE_SECRET_KEY = "test-secret";
  process.env.SESSION_SECRET = "s".repeat(48);
  process.env.BUFFER_CLIENT_ID = "client-123";
  process.env.BUFFER_REDIRECT_URI = "https://pollen.test/api/auth/buffer/callback";
  delete process.env.BUFFER_CLIENT_SECRET;

  const f: Fakes = {
    supabase: new FakeSupabase(),
    auth: new FakeBufferAuth(),
    graphqlCalls: [],
    graphql: () => new Response(JSON.stringify({ errors: [{ message: "no GraphQL handler set in this test" }] }), { status: 500 }),
    strays: [],
    reset() {
      f.supabase = new FakeSupabase();
      f.auth = new FakeBufferAuth();
      f.graphqlCalls = [];
      f.strays = [];
      f.graphql = () => new Response(JSON.stringify({ errors: [{ message: "no GraphQL handler set in this test" }] }), { status: 500 });
    },
    restore() {
      globalThis.fetch = real;
    },
  };

  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (init.signal?.aborted) throw init.signal.reason;
    if (url.host === "db.test") return f.supabase.handle(url, init);
    if (url.host === "auth.buffer.com" && url.pathname === "/token") return f.auth.handle(init);
    if (url.host === "api.buffer.com") {
      const headers = new Headers(init.headers);
      const query = (JSON.parse(String(init.body ?? "{}")) as { query?: string }).query ?? "";
      const token = (headers.get("Authorization") ?? "").replace(/^Bearer /, "");
      f.graphqlCalls.push({ query, token });
      // honour the caller's timeout: if the handler never answers, abort like fetch does
      const answer = Promise.resolve(f.graphql(query, { token, headers }));
      if (!init.signal) return answer;
      return Promise.race([
        answer,
        new Promise<never>((_, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true })),
      ]);
    }
    f.strays.push(url.href);
    throw new Error(`Unexpected network call in a test: ${url.href}`);
  }) as typeof fetch;

  return f;
}

export const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
