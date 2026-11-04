import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { linkMode } from "@/lib/flow";
import { readPublicPost } from "@/lib/publicPost";
import { savePublicSource } from "@/lib/publicSources";
import { isSameSite } from "@/lib/sameSite";

// "Get content" on the source step: reads one public newsletter post, saves it as the user's source and returns what the
// "Your post" row shows, plus the `mode` the later steps use. The page itself is read again only for the Manual tab.
const noStore = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  if (!isSameSite(req)) return NextResponse.json({ error: "Not allowed." }, { status: 403, headers: noStore });
  const g = await requireSession(req);
  if ("response" in g) return g.response;
  const body = (await req.json().catch(() => ({}))) as { url?: unknown };
  const r = await readPublicPost(typeof body.url === "string" ? body.url : "", g.session.userId);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status, headers: noStore });
  try {
    const source = await savePublicSource(g.session.userId, r.post);
    return NextResponse.json({ mode: linkMode(source.id), ...source }, { headers: noStore });
  } catch (e) {
    console.error("saving the public source failed:", (e as Error).message);
    return NextResponse.json({ error: "Couldn't save that link. Try again in a moment." }, { status: 503, headers: noStore });
  }
}
