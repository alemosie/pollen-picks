import { NextRequest, NextResponse } from "next/server";
import { gql, siteOrigin } from "@/lib/buffer";
import { requireSession } from "@/lib/guard";
import { signPreview } from "@/lib/previewSig";
import { loadAppIssue } from "@/lib/sources";
import { planSlides } from "@/lib/slides/plan";
import { slideItemsFor } from "@/lib/slides/items";
import { parseTemplateFrom, templateParams } from "@/lib/slides/options";
import { imageLimit, unsupportedReason } from "@/lib/channels";
import { logDrafts } from "@/lib/draftLog";

export type DraftResult = { channelId: string; ok: boolean; postId?: string; error?: string; slides?: number; note?: string };

/**
 * Create one Buffer draft (never published) per selected channel from picked chunks of the user's own content.
 * The sample issue can't be sent: it only exists in the public /demo flow, and a request without a real `source` is refused.
 * Buffer fetches the slide images itself, so the URLs must be publicly reachable (not localhost).
 */
export async function POST(req: NextRequest) {
  const g = await requireSession(req);
  if ("response" in g) return g.response;

  const body = (await req.json().catch(() => ({}))) as { source?: string; channels?: { id: string; service: string }[]; picks?: number[]; caption?: string; captions?: Record<string, string>; template?: string };

  // Fail closed, before anything touches Buffer. No source (or the sample issue) means no content to send.
  const issue = await loadAppIssue(body.source);
  if (!issue) {
    return NextResponse.json({ error: "The sample issue can't be sent to Buffer. Connect your own newsletter to create posts." }, { status: 403 });
  }

  const picks = (body.picks ?? []).filter(Number.isFinite);
  const channels = (body.channels ?? []).filter((c) => c?.id);
  if (channels.length === 0) return NextResponse.json({ error: "Choose at least one channel." }, { status: 400 });
  if (picks.length === 0) return NextResponse.json({ error: "No picks." }, { status: 400 });

  const base = (process.env.PUBLIC_BASE_URL ?? siteOrigin()).replace(/\/$/, "");
  if (/localhost|127\.0\.0\.1/.test(base)) {
    return NextResponse.json({ error: `Slide images are served from ${base}, which Buffer can't reach. Use the deployed site (or set PUBLIC_BASE_URL to a tunnel).` }, { status: 400 });
  }

  const tpl = parseTemplateFrom(new URLSearchParams(body.template ?? ""));
  const slides = planSlides(slideItemsFor(issue.chunks, picks), { newsletter: issue.newsletter, ...tpl });
  // Buffer fetches the images with no login, so the URLs are signed for this user, issue, picks and template (see previewSig).
  const signed = signPreview(new URLSearchParams([...templateParams(tpl).entries(), ["picks", picks.join(",")], ["mode", body.source as string]]), g.session.userId).toString();
  const all = slides.map((_, i) => `${base}/api/slide/preview?${signed}&n=${i}`);

  // Sequential: a handful of channels, and it keeps us well inside Buffer's rate limits.
  const results: DraftResult[] = [];
  for (const c of channels) {
    const blocked = unsupportedReason(c.service);
    if (blocked) {
      results.push({ channelId: c.id, ok: false, error: blocked });
      continue;
    }
    const limit = imageLimit(c.service);
    const images = all.slice(0, limit);
    const note = images.length < all.length ? `Only the first ${images.length} of ${all.length} slides fit on ${c.service}.` : undefined;
    const text = JSON.stringify(body.captions?.[c.id] ?? body.caption ?? "");
    const assets = images.map((u) => `{ image: { url: ${JSON.stringify(u)} } }`).join(", ");
    const metadata = c.service.toLowerCase() === "instagram" ? "metadata: { instagram: { type: post, shouldShareToFeed: true } }" : "";
    const query = `mutation {
      createPost(input: {
        text: ${text}
        channelId: ${JSON.stringify(c.id)}
        schedulingType: automatic
        mode: addToQueue
        saveToDraft: true
        ${metadata}
        assets: [${assets}]
      }) {
        ... on PostActionSuccess { post { id } }
        ... on MutationError { message }
      }
    }`;
    try {
      const r = await gql<{ createPost: { post?: { id: string }; message?: string } }>(g.session.accessToken, query);
      const cp = r.data?.createPost;
      if (r.errors?.length || !cp?.post) {
        results.push({ channelId: c.id, ok: false, error: cp?.message ?? r.errors?.[0]?.message ?? `Buffer returned ${r.status}` });
      } else {
        results.push({ channelId: c.id, ok: true, postId: cp.post.id, slides: images.length, note });
      }
    } catch (e) {
      results.push({ channelId: c.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  await logDrafts(
    g.session.userId,
    results.map((r) => ({ service: channels.find((c) => c.id === r.channelId)?.service ?? "unknown", ok: r.ok, error: r.error })),
  );
  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: okCount > 0, results }, { status: okCount > 0 ? 200 : 502 });
}
