import { NextRequest, NextResponse } from "next/server";
import { isPublicationId } from "@/lib/flow";
import { requireSession } from "@/lib/guard";
import { loadIssueList } from "@/lib/issues";

// One page (5) of the signed-in user's sent issues, newest first. Optional ?publication=pub_... when the key covers several, and ?page=N.
export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  const pub = req.nextUrl.searchParams.get("publication");
  if (pub !== null && !isPublicationId(pub)) return NextResponse.json({ error: "That publication isn't valid." }, { status: 400 });
  const page = Number(req.nextUrl.searchParams.get("page") ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 1000) return NextResponse.json({ error: "That page isn't valid." }, { status: 400 });
  const result = await loadIssueList(auth.session.userId, pub, page);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(result.list, { headers: { "Cache-Control": "no-store" } });
}
