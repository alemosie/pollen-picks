import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { renderableDocument } from "@/lib/pollen/render";

// The sample issue as published, for the demo's Manual tab. Public: it is the same fixture the demo already shows.
export function GET() {
  const html = renderableDocument(
    readFileSync(join(process.cwd(), "fixtures", "issue-49.html"), "utf8"),
  );
  if (!html)
    return NextResponse.json(
      { error: "The sample issue can't be shown right now." },
      { status: 500 },
    );
  return NextResponse.json(
    { html },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
