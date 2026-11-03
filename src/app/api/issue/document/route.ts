import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { loadAppIssueDocument } from "@/lib/sources";

// The signed-in user's issue as published, sanitised for the Manual tab's sandboxed iframe.
export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  const result = await loadAppIssueDocument(req.nextUrl.searchParams.get("mode") ?? undefined);
  const headers = { "Cache-Control": "no-store" };
  if (!result) return NextResponse.json({ error: "Highlighting works on your own newsletter." }, { status: 400, headers });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 502, headers });
  return NextResponse.json(result, { headers });
}
