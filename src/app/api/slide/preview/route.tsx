import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth";
import { loadDemoIssueWithHighlights } from "@/lib/demoServer";
import { isDemo } from "@/lib/flow";
import { verifyPreview } from "@/lib/previewSig";
import { loadAppIssue } from "@/lib/sources";
import { prepareSlideSet } from "@/lib/slides/slideSet";
import { DEMO_HL_COOKIE } from "@/lib/pollen/demoHighlights";
import { DEMO_SRC_COOKIE } from "@/lib/pollen/demoSource";
import { parseTemplateFrom } from "@/lib/slides/options";

// Slide preview: /api/slide/preview?picks=4,5,6&n=0  (n = slide index, 0 = cover).
// Without `mode` (or with mode=demo) the picks index the sample issue plus the visitor's demo highlights. With the mode of one
// of the user's own issues (own:<publication>:<post>) they index that issue, which needs their session.
export async function GET(req: NextRequest) {
  try {
    return await draw(req);
  } catch (e) {
    // Next's own signals (a digest, e.g. the prerender bailout during `next build`) must reach Next, not become a 500.
    if (typeof (e as { digest?: unknown })?.digest === "string") throw e;
    // An unhandled throw here is an empty 500 the page can only call "the server answered 500". Log it and say what failed.
    console.error("drawing the slide failed:", e);
    const why = process.env.NODE_ENV === "development" && e instanceof Error ? ` (${e.message})` : "";
    return NextResponse.json({ error: `Couldn't draw this slide${why}. Try again in a moment.` }, { status: 500 });
  }
}

async function draw(req: NextRequest): Promise<Response> {
  const q = req.nextUrl.searchParams;
  const mode = q.get("mode");
  // Buffer fetches these images without a login, so its URLs carry a signature instead (see previewSig). A bad or expired one is refused.
  const signedUid = q.has("sig") ? verifyPreview(q) : null;
  if (q.has("sig") && !signedUid) return NextResponse.json({ error: "This slide link is invalid or has expired." }, { status: 403 });
  const issue = mode && !isDemo(mode) ? await loadAppIssue(mode, signedUid ?? undefined) : await loadDemoIssueWithHighlights();
  if (!issue) return NextResponse.json({ error: "Couldn't load this issue. Log in again from the Source step." }, { status: 401 });
  const ids = (q.get("picks") ?? "").split(",").filter(Boolean).map(Number).filter(Number.isFinite);
  const ownIssue = Boolean(mode && !isDemo(mode));
  // The user's slide style (Settings) applies where the address belongs to them alone: a signed link, or one of their own issues. The shared
  // demo addresses never use it, or a CDN could hand one person's organization name and logo to everyone.
  const uid = signedUid ?? (ownIssue ? await sessionUserId() : null);
  const set = await prepareSlideSet({ issue, ids, template: parseTemplateFrom(q), uid, ownIssue });
  if (!set) return NextResponse.json({ error: "No picks" }, { status: 400 });
  const n = Number(q.get("n") ?? 0);
  if (!(n >= 0 && n < set.count)) return NextResponse.json({ error: `n must be 0-${set.count - 1}` }, { status: 400 });
  // On-screen previews ask for a smaller WebP (fmt=web). Signed links are what Buffer downloads, so they always stay full-size PNG.
  const web = q.get("fmt") === "web" && !q.has("sig") ? { width: Math.min(1080, Math.max(200, Number(q.get("w")) || 540)) } : undefined;
  // A signed address with fmt=jpg is the small JPEG for networks that refuse large images (see needsSmallImages). Only Buffer-facing links can ask for it.
  const smallJpeg = q.get("fmt") === "jpg" && Boolean(signedUid);
  const res = await set.render(n, { web, smallJpeg });
  // A signed address always means the same slides (a new send is signed again, so it gets a new address), and it is what Buffer keeps fetching
  // (its own image proxy and thumbnails included): never ask it to check back every few minutes, which re-draws a slide that went cold in the CDN.
  if (signedUid) res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  if (!mode || isDemo(mode)) {
    // In the demo the address says only which picks (numbers) and which template. What those picks say comes from this visitor's cookies (the page
    // they pasted, the text they highlighted), so the same address can mean different slides. The browser keeps nothing across visits, and Netlify's
    // CDN keeps one copy per combination of those cookies instead of one per address.
    res.headers.set("Cache-Control", "private, no-cache");
    res.headers.set("Netlify-Vary", `query,cookie=${DEMO_SRC_COOKIE}|${DEMO_HL_COOKIE}`);
  }
  return res;
}
