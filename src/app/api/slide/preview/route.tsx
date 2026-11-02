import { NextRequest, NextResponse } from "next/server";
import { loadDemoIssue } from "@/lib/demo";
import { DEFAULT_COLORS } from "@/lib/brand";
import { planSlides } from "@/lib/slides/plan";
import { renderSlide } from "@/lib/slides/render";
import { slideItemsFor } from "@/lib/slides/items";
import { parseTemplateFrom } from "@/lib/slides/options";

// Preview from the demo issue: /api/slide/preview?picks=4,5,6&n=0  (n = slide index, 0 = cover).
// The real route renders from a stored pick set; this one exists to design and test templates.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const issue = loadDemoIssue();
  const items = slideItemsFor(issue.chunks, (q.get("picks") ?? "").split(",").map(Number).filter(Number.isFinite));
  if (items.length === 0) return NextResponse.json({ error: "No picks" }, { status: 400 });
  const slides = planSlides(items, { newsletter: "Just a Phase", ...parseTemplateFrom(q) });
  const n = Number(q.get("n") ?? 0);
  if (!(n >= 0 && n < slides.length)) return NextResponse.json({ error: `n must be 0-${slides.length - 1}` }, { status: 400 });
  return renderSlide(slides[n], { name: "Just a Phase", colors: DEFAULT_COLORS });
}
