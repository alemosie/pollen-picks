import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth";
import { loadDemoIssueWithHighlights } from "@/lib/demoServer";
import { isDemo } from "@/lib/flow";
import { verifyPreview } from "@/lib/previewSig";
import { loadAppIssue } from "@/lib/sources";
import { DEFAULT_COLORS } from "@/lib/brand";
import { loadSlideStyle } from "@/lib/slideStyleStore";
import { DEFAULT_STYLE } from "@/lib/slides/style";
import { styleKit, withCoverPhoto, withPhotos } from "@/lib/slides/kit";
import { linkImagesFor } from "@/lib/pollen/linkImages";
import { photoLinkUrl } from "@/lib/userPhotoLinks";
import { planSlides } from "@/lib/slides/plan";
import { renderSlide } from "@/lib/slides/render";
import { DEMO_HL_COOKIE } from "@/lib/pollen/demoHighlights";
import { DEMO_SRC_COOKIE } from "@/lib/pollen/demoSource";
import { knownForPicks } from "@/lib/instagramHandles";
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
  const ids = (q.get("picks") ?? "").split(",").filter(Boolean).map(Number).filter(Number.isFinite);
  const items = slideItemsFor(issue.chunks, ids, await knownForPicks(issue.chunks, ids));
  if (items.length === 0) return NextResponse.json({ error: "No picks" }, { status: 400 });
  const slides = planSlides(items, { newsletter: issue.newsletter, defaultCoverPhoto: issue.images?.find((i) => i.preview)?.id, ...parseTemplateFrom(q) });
  const n = Number(q.get("n") ?? 0);
  if (!(n >= 0 && n < slides.length)) return NextResponse.json({ error: `n must be 0-${slides.length - 1}` }, { status: 400 });
  // The user's slide style (Settings) applies where the address belongs to them alone: a signed link, or one of their own issues. The shared
  // demo addresses never use it, or a CDN could hand one person's organization name and logo to everyone.
  const uid = signedUid ?? (mode && !isDemo(mode) ? await sessionUserId() : null);
  const saved = uid ? await loadSlideStyle(uid) : null;
  // Someone who has not chosen a slide style (a row that only holds a palette or an organization is not one) gets the standard look: DEFAULT_STYLE.
  const slide = slides[n];
  // A picture link the user saved is theirs alone: only looked up where the address belongs to them (uid).
  const savedLink = uid ? (id: string) => photoLinkUrl(uid, id) : undefined;
  const drawn = slide.kind === "picks" ? { ...slide, items: await withPhotos(slide.items, issue.images, mode && !isDemo(mode) ? (id) => linkImagesFor(issue.chunks.find((c) => c.id === id)?.url) : undefined, savedLink) } : await withCoverPhoto(slide, issue.images, savedLink);
  // On-screen previews ask for a smaller WebP (fmt=web). Signed links are what Buffer downloads, so they always stay full-size PNG.
  const web = q.get("fmt") === "web" && !q.has("sig") ? { width: Math.min(1080, Math.max(200, Number(q.get("w")) || 540)) } : undefined;
  // A signed address with fmt=jpg is the small JPEG for networks that refuse large images (see needsSmallImages). Only Buffer-facing links can ask for it.
  const smallJpeg = q.get("fmt") === "jpg" && Boolean(signedUid);
  const res = await renderSlide(drawn, { name: issue.newsletter, colors: DEFAULT_COLORS, ...(uid ? { ...(await styleKit(saved?.styled ? saved.style : { ...DEFAULT_STYLE, orgName: saved?.style.orgName ?? "", orgLogo: saved?.style.orgLogo ?? null }, issue)), ...(saved?.styled ? { styled: true } : {}) } : {}) }, web, { smallJpeg });
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
