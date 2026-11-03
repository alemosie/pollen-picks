import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { renderableDocument } from "@/lib/pollen/render";

// The sample issue as published, for the demo's Manual tab. Public: it is the same issue the demo already shows.
// fixtures/issue-49.web.html is the issue's real web page (what beehiiv serves, with its own styles). Without it the
// plain editor HTML of the sample issue is shown, which is the same text without the newsletter's look.
export function GET() {
  const dir = join(process.cwd(), "fixtures");
  const web = join(dir, "issue-49.web.html");
  const html = renderableDocument(readFileSync(existsSync(web) ? web : join(dir, "issue-49.html"), "utf8"));
  if (!html) return NextResponse.json({ error: "The sample issue can't be shown right now." }, { status: 500 });
  return NextResponse.json({ html }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
