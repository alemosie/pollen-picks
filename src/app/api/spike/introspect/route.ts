import { NextRequest, NextResponse } from "next/server";
import { gql } from "@/lib/buffer";
import { requireSession } from "@/lib/guard";

type TypeRef = { name: string | null; kind: string; ofType?: TypeRef | null };
const leaf = (t: TypeRef | null | undefined): string | null => (t ? (t.name ?? leaf(t.ofType)) : null);
const TYPE_Q = (n: string) =>
  `{ __type(name: "${n}") { name kind inputFields { name type { name kind ofType { name kind ofType { name kind ofType { name kind ofType { name kind } } } } } } enumValues { name } } }`;

// Spike helper: the docs don't list every createPost field (drafts, carousel metadata),
// so read them from the schema itself.
export async function GET(req: NextRequest) {
  try {
    return await run(req);
  } catch (e) {
    return NextResponse.json({ error: String(e), stack: (e as Error).stack?.split("\n").slice(0, 6) }, { status: 500 });
  }
}

async function run(req: NextRequest) {
  const g = await requireSession(req);
  if ("response" in g) return g.response;
  const token = g.session.accessToken;

  const root = await gql<{ __schema: { mutationType: { fields: { name: string; args: { name: string; type: TypeRef }[] }[] } } }>(
    token,
    `{ __schema { mutationType { fields { name args { name type { name kind ofType { name kind ofType { name kind } } } } } } } }`,
  );
  if (root.errors) return NextResponse.json({ step: "schema", errors: root.errors, status: root.status }, { status: 502 });
  const createPost = root.data?.__schema.mutationType.fields.find((f) => f.name === "createPost");
  const inputType = leaf(createPost?.args.find((a) => a.name === "input")?.type);
  if (!inputType) return NextResponse.json({ error: "createPost input type not found", mutations: root.data?.__schema.mutationType.fields.map((f) => f.name) });

  const main = await gql<{ __type: { inputFields: { name: string; type: TypeRef }[] } }>(token, TYPE_Q(inputType));
  const out: Record<string, unknown> = { inputType, fields: main.data?.__type.inputFields.map((f) => `${f.name}: ${leaf(f.type)}`) };

  // Expand the interesting sub-types, recursing into input objects (depth-limited).
  type Tq = { __type: { kind: string; inputFields?: { name: string; type: TypeRef }[]; enumValues?: { name: string }[] } | null };
  async function expand(tn: string, depth: number): Promise<unknown> {
    const t = await gql<Tq>(token, TYPE_Q(tn));
    const ty = t.data?.__type;
    if (!ty) return null;
    if (ty.enumValues) return ty.enumValues.map((e) => e.name);
    const o: Record<string, unknown> = {};
    for (const x of ty.inputFields ?? []) {
      const xn = leaf(x.type);
      const label = `${x.name}: ${xn}`;
      o[label] = depth > 0 && xn && !/^(String|Boolean|Int|Float|ID|DateTime)$/.test(xn) && !xn.endsWith("Id") ? await expand(xn, depth - 1) : null;
    }
    return o;
  }
  const wanted = ["schedulingType", "mode", "assets"];
  for (const f of main.data?.__type.inputFields ?? []) {
    const tn = leaf(f.type);
    if (!tn) continue;
    if (wanted.includes(f.name)) out[`${f.name} (${tn})`] = await expand(tn, 2);
  }
  out["UserTagInput"] = await expand("UserTagInput", 1);
  const meta = main.data?.__type.inputFields.find((f) => f.name === "metadata");
  const metaType = leaf(meta?.type);
  if (metaType) {
    const m = await gql<Tq>(token, TYPE_Q(metaType));
    for (const x of m.data?.__type?.inputFields ?? []) {
      const xn = leaf(x.type);
      if (xn && ["instagram", "linkedin"].includes(x.name)) out[`metadata.${x.name} (${xn})`] = await expand(xn, 2);
    }
  }
  return NextResponse.json(out);
}
