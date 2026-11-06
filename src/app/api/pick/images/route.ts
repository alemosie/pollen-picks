import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth";
import { isDemo } from "@/lib/flow";
import { allowFetch } from "@/lib/publicFetch";
import { linkPageFor } from "@/lib/pollen/linkImages";
import type { IssueImage } from "@/lib/pollen/imageIds";
import { PHOTO_MAX_PICKS } from "@/lib/slides/types";
import { loadAppIssue } from "@/lib/sources";
import { isSameSite } from "@/lib/sameSite";

// The pictures on the pages the picks link to, for the picture row in the slide editor:
// /api/pick/images?mode=own:...&picks=4,5  ->  { images: { "4": [IssueImage...], "5": [...] }, sites: { "4": "Luma", "5": "venue.example.org" } }
// (the site name is the suggestion for a photo credit)
// Only the user's own issues (the demo's links are not read), only picks of that issue, and only as many as fit on one slide.
const noStore = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  if (!isSameSite(req)) return NextResponse.json({ error: "Not allowed." }, { status: 403, headers: noStore });
  const uid = await sessionUserId();
  if (!uid) return NextResponse.json({ error: "Log in again to continue." }, { status: 401, headers: noStore });
  const q = req.nextUrl.searchParams;
  const mode = q.get("mode") ?? "";
  if (!mode || isDemo(mode)) return NextResponse.json({ images: {} }, { headers: noStore });
  const ids = [...new Set((q.get("picks") ?? "").split(",").filter(Boolean).map(Number).filter(Number.isInteger))].slice(0, PHOTO_MAX_PICKS);
  if (ids.length === 0) return NextResponse.json({ images: {} }, { headers: noStore });
  // Each pick is a page read: keep a signed-in user from looping on this.
  if (!allowFetch(`pick-images:${uid}`, 60)) return NextResponse.json({ error: "Try again in a few minutes." }, { status: 429, headers: noStore });
  const issue = await loadAppIssue(mode);
  if (!issue) return NextResponse.json({ error: "Couldn't load this issue." }, { status: 401, headers: noStore });
  const pages = await Promise.all(ids.map(async (id) => [id, await linkPageFor(issue.chunks.find((c) => c.id === id)?.url)] as const));
  return NextResponse.json(
    { images: Object.fromEntries(pages.map(([id, p]): [number, IssueImage[]] => [id, p.images])), sites: Object.fromEntries(pages.map(([id, p]) => [id, p.site])) },
    { headers: noStore },
  );
}
