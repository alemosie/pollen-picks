import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { gql } from "@/lib/buffer";
import { requireSession } from "@/lib/auth";
import Tools from "./Tools";

type Org = { id: string; name: string };
type Channel = { id: string; name: string; service: string };

// cacheComponents: request-time data (cookies) must be read inside a Suspense boundary.
export default function Spike() {
  return (
    <Suspense fallback={<p style={{ fontFamily: "system-ui", margin: 40 }}>Loading…</p>}>
      <SpikeContent />
    </Suspense>
  );
}

async function SpikeContent() {
  await connection(); // request-time render: the session check reads the cookie and the clock
  const session = await requireSession("/spike");

  const acct = await gql<{ account: { id: string; email: string; organizations: Org[] } }>(
    session.accessToken,
    `{ account { id email organizations { id name } } }`,
  );
  if (acct.status === 401) redirect("/api/auth/buffer/refresh");
  const orgs = acct.data?.account.organizations ?? [];

  const channels: Channel[] = [];
  const errors: unknown[] = [...(acct.errors ?? [])];
  for (const o of orgs) {
    const r = await gql<{ channels: Channel[] }>(session.accessToken, `{ channels(input: { organizationId: ${JSON.stringify(o.id)} }) { id name service } }`);
    channels.push(...(r.data?.channels ?? []));
    if (r.errors) errors.push(...r.errors);
  }

  return (
    <main style={{ maxWidth: 760, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui" }}>
      <h1>Buffer OAuth spike</h1>
      <p>
        Connected as <b>{acct.data?.account.email ?? "?"}</b> · <a href="/api/auth/buffer/logout">disconnect</a>
      </p>
      <h2>Organizations</h2>
      <ul>{orgs.map((o) => <li key={o.id}>{o.name} <code>{o.id}</code></li>)}</ul>
      <h2>Channels</h2>
      <ul>{channels.map((c) => <li key={c.id}>{c.service} · {c.name} <code>{c.id}</code></li>)}</ul>
      {errors.length > 0 && <pre>{JSON.stringify(errors, null, 2)}</pre>}
      <h2>Tests</h2>
      <Tools channels={channels} />
    </main>
  );
}
