import { NextRequest, NextResponse } from "next/server";
import { loadDemoIssueWithHighlights } from "@/lib/demoServer";
import { isDemo } from "@/lib/flow";
import { verifyPreview } from "@/lib/previewSig";
import { loadAppIssue } from "@/lib/sources";
import { DEFAULT_COLORS } from "@/lib/brand";
import { planSlides } from "@/lib/slides/plan";
import { renderSlide } from "@/lib/slides/render";
import { slideItemsFor } from "@/lib/slides/items";
import { parseTemplateFrom } from "@/lib/slides/options";

// Slide preview: /api/slide/preview?picks=4,5,6&n=0  (n = slide index, 0 = cover).
// Without `mode` (or with mode=demo) the picks index the sample issue plus the visitor's demo highlights. With the mode of one
// of the user's own issues (own:<publication>:<post>) they index that issue, which needs their session.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const mode = q.get("mode");
  // Buffer fetches these images without a login, so its URLs carry a signature instead (see previewSig). A bad or expired one is refused.
  const signedUid = q.has("sig") ? verifyPreview(q) : null;
  if (q.has("sig") && !signedUid) return NextResponse.json({ error: "This slide link is invalid or has expired." }, { status: 403 });
  const issue = mode && !isDemo(mode) ? await loadAppIssue(mode, signedUid ?? undefined) : await loadDemoIssueWithHighlights();
  if (!issue) return NextResponse.json({ error: "Couldn't load this issue. Log in again from the Source step." }, { status: 401 });
  const items = slideItemsFor(issue.chunks, (q.get("picks") ?? "").split(",").filter(Boolean).map(Number).filter(Number.isFinite));
  if (items.length === 0) return NextResponse.json({ error: "No picks" }, { status: 400 });
  const slides = planSlides(items, { newsletter: issue.newsletter, ...parseTemplateFrom(q) });
  const n = Number(q.get("n") ?? 0);
  if (!(n >= 0 && n < slides.length)) return NextResponse.json({ error: `n must be 0-${slides.length - 1}` }, { status: 400 });
  return renderSlide(slides[n], { name: issue.newsletter, colors: DEFAULT_COLORS });
}
