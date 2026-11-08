// Test-only. Runs the in-memory Supabase (see ./fakes) as a real HTTP server, so a real `next dev` can talk to it in a browser test.
//   npx tsx src/test/fakeServer.ts            serves http://127.0.0.1:54321
// Extra routes for the test to look inside: GET /__dump/<table>  and  POST /__seed  (signed-in user + fake beehiiv + Buffer session).
// Never used by the app itself.

import { createServer } from "node:http";
import { seal } from "../lib/session";
import { checkKey } from "../lib/beehiiv";
import { FAKE_KEY } from "../lib/fakeBeehiiv";
import { FakeSupabase } from "./fakes";

const PORT = Number(process.env.FAKE_DB_PORT ?? 54321);
const db = new FakeSupabase();
export const UID = "00000000-0000-4000-8000-0000000000aa";

async function seed() {
  db.seedSession(UID, { accessToken: "e2e-access-token", refreshToken: "e2e-refresh", expiresAt: Date.now() + 24 * 3_600_000 });
  const publications = await checkKey(FAKE_KEY);
  db.connections.set(`${UID}:beehiiv`, { secret: FAKE_KEY, last4: FAKE_KEY.slice(-4), meta: { publications }, status: "active", leaseHeld: false });
  return { uid: UID, cookie: seal({ uid: UID }), publications: publications.map((p) => ({ id: p.id, name: p.name })) };
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = Buffer.concat(chunks).toString("utf8");
    const send = (status: number, payload: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    };
    if (url.pathname === "/__seed") return send(200, await seed());
    if (url.pathname.startsWith("/__dump/")) return send(200, db.rows(url.pathname.slice(8)));
    if (url.pathname === "/__reset") {
      db.tables.clear();
      return send(200, { ok: true });
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
    const r = db.handle(url, { method: req.method, headers, body: body || undefined });
    res.writeHead(r.status, Object.fromEntries(r.headers.entries()));
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: (e as Error).message }));
  }
}).listen(PORT, "127.0.0.1", () => console.log(`fake supabase on http://127.0.0.1:${PORT}`));
