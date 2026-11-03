import { NextRequest, NextResponse } from "next/server";
import { loadDemoIssueWithHighlights } from "@/lib/demoServer";
import { isDemo } from "@/lib/flow";
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
  const issue = mode && !isDemo(mode) ? await loadAppIssue(mode) : await loadDemoIssueWithHighlights();
  if (!issue) return NextResponse.json({ error: "Couldn't load this issue. Log in again from the Source step." }, { status: 401 });
  const items = slideItemsFor(issue.chunks, (q.get("picks") ?? "").split(",").filter(Boolean).map(Number).filter(Number.isFinite));
  if (items.length === 0) return NextResponse.json({ error: "No picks" }, { status: 400 });
  const slides = planSlides(items, { newsletter: "Just a Phase", ...parseTemplateFrom(q) });
  const n = Number(q.get("n") ?? 0);
  if (!(n >= 0 && n < slides.length)) return NextResponse.json({ error: `n must be 0-${slides.length - 1}` }, { status: 400 });
  return renderSlide(slides[n], { name: "Just a Phase", colors: DEFAULT_COLORS });
}
