import { NextRequest, NextResponse } from "next/server";
import { readPublicPost } from "@/lib/publicPost";
import { isSameSite } from "@/lib/sameSite";

// A public newsletter or blog post for the demo's Manual tab: /api/demo/source?url=<web address>. It reads that one page,
// strips it down to the article and hands it back as a document that is safe to show in a sandboxed iframe. Nothing is stored.
export async function GET(req: NextRequest) {
  if (!isSameSite(req)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const visitor = req.headers.get("x-nf-client-connection-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const r = await readPublicPost(req.nextUrl.searchParams.get("url") ?? "", visitor);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r.post, { headers: { "Cache-Control": "no-store" } });
}
