import { NextRequest, NextResponse } from "next/server";
import { addCustomChunk, removeCustomChunk } from "@/lib/customPicks";
import { requireSession } from "@/lib/guard";
import { cleanHighlight, cleanHighlightUrl, cleanLinkText, isCustomId, MAX_HIGHLIGHTS_PER_ISSUE } from "@/lib/pollen/custom";
import { resolveIssueOwner } from "@/lib/sources";

// Save or remove a highlight made on the Pick page's Manual tab. A highlight belongs to one user and one issue.

const noStore = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });

export async function POST(req: NextRequest) {
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  const body = (await req.json().catch(() => null)) as { mode?: unknown; text?: unknown; url?: unknown; linkText?: unknown } | null;
  const text = cleanHighlight(body?.text);
  if (!text) return fail("Select a little text first (up to 2,000 characters).", 400);

  const owner = await resolveIssueOwner(typeof body?.mode === "string" ? body.mode : undefined);
  if (!owner) return fail("Highlighting works on your own newsletter.", 400);
  if ("error" in owner) return fail(owner.error, 400);
  try {
    const url = cleanHighlightUrl(body?.url);
    const chunk = await addCustomChunk(owner.uid, owner.issue, text, url, cleanLinkText(body?.linkText, text, url));
    if (!chunk) return fail(`You can keep up to ${MAX_HIGHLIGHTS_PER_ISSUE} highlights per issue. Remove one first.`, 409);
    return NextResponse.json({ chunk }, { headers: noStore });
  } catch (e) {
    console.error("saving a highlight failed:", (e as Error).message);
    return fail("Couldn't save the highlight. Try again in a moment.", 503);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  const mode = req.nextUrl.searchParams.get("mode") ?? undefined;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || !isCustomId(id)) return fail("Unknown highlight.", 400);
  const owner = await resolveIssueOwner(mode);
  if (!owner || "error" in owner) return fail(owner ? owner.error : "Highlighting works on your own newsletter.", 400);
  try {
    await removeCustomChunk(owner.uid, owner.issue, id);
    return NextResponse.json({ removed: id }, { headers: noStore });
  } catch (e) {
    console.error("removing a highlight failed:", (e as Error).message);
    return fail("Couldn't remove the highlight. Try again in a moment.", 503);
  }
}
