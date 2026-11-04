import { NextRequest, NextResponse } from "next/server";
import { allowFetch, fetchPublicPage, PublicFetchError } from "@/lib/publicFetch";
import { renderablePublicPage } from "@/lib/pollen/render";
import { isSameSite } from "@/lib/sameSite";

// A public newsletter or blog post for the demo's Manual tab: /api/demo/source?url=<web address>. It reads that one page,
// strips it down to the article and hands it back as a document that is safe to show in a sandboxed iframe. Nothing is stored.
export async function GET(req: NextRequest) {
  if (!isSameSite(req)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const url = req.nextUrl.searchParams.get("url") ?? "";
  if (!url || url.length > 2000) return NextResponse.json({ error: "Paste a link to a newsletter post." }, { status: 400 });
  const visitor = req.headers.get("x-nf-client-connection-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!allowFetch(visitor)) return NextResponse.json({ error: "That's a lot of links. Try again in a few minutes." }, { status: 429 });
  try {
    const page = await fetchPublicPage(url);
    const doc = renderablePublicPage(page.html, page.url);
    if (!doc) return NextResponse.json({ error: "Couldn't find any readable text on that page." }, { status: 422 });
    return NextResponse.json({ ...doc, url: page.url }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (e) {
    if (e instanceof PublicFetchError) {
      const status = e.kind === "disabled" ? 503 : e.kind === "rate-limited" ? 429 : e.kind === "failed" ? 502 : 400;
      return NextResponse.json({ error: e.message }, { status });
    }
    console.error("public source failed:", (e as Error).message);
    return NextResponse.json({ error: "Couldn't read that page." }, { status: 500 });
  }
}
