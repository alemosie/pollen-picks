import { NextRequest, NextResponse } from "next/server";
import { siteOrigin } from "@/lib/buffer";
import { createChannelPost, fakeMode, type PostIntent } from "@/lib/bufferPost";
import { requireSession } from "@/lib/guard";
import { signPreview } from "@/lib/previewSig";
import { loadAppIssue } from "@/lib/sources";
import { planSlides } from "@/lib/slides/plan";
import { slideItemsFor } from "@/lib/slides/items";
import { parseTemplateFrom, templateParams } from "@/lib/slides/options";
import { imageLimit, unsupportedReason } from "@/lib/channels";
import { logDrafts } from "@/lib/draftLog";

export type DraftResult = {
  channelId: string;
  ok: boolean;
  postId?: string;
  error?: string;
  slides?: number;
  note?: string;
  /** Only for a publish that died mid-request: it may or may not have gone out, so it is never retried automatically. */
  unknown?: boolean;
  /** True when this ran in fake mode (nothing reached Buffer). */
  fake?: boolean;
};

/**
 * Create one Buffer post per selected channel from picked chunks of the user's own content.
 * `intent: "draft"` (the default) saves a draft that is never published. `intent: "now"` publishes immediately and must
 * carry `confirmed: true`, which the confirmation dialog sets, so a stray request can't publish anything.
 * The sample issue can't be sent: it only exists in the public /demo flow, and a request without a real `source` is refused.
 * Buffer fetches the slide images itself, so the URLs must be publicly reachable (not localhost).
 */
export async function POST(req: NextRequest) {
  const g = await requireSession(req);
  if ("response" in g) return g.response;

  const body = (await req.json().catch(() => ({}))) as { source?: string; channels?: { id: string; service: string }[]; picks?: number[]; caption?: string; captions?: Record<string, string>; template?: string; intent?: string; confirmed?: boolean };
  const intent: PostIntent = body.intent === "now" ? "now" : "draft";
  if (intent === "now" && body.confirmed !== true) {
    return NextResponse.json({ error: "Sending now needs confirmation." }, { status: 400 });
  }

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
  if (!fakeMode() && /localhost|127\.0\.0\.1/.test(base)) {
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
    const text = body.captions?.[c.id] ?? body.caption ?? "";
    const out = await createChannelPost(g.session.accessToken, { channelId: c.id, service: c.service, text, images, intent });
    results.push(
      out.ok
        ? { channelId: c.id, ok: true, postId: out.postId, slides: images.length, note, fake: fakeMode() || undefined }
        : { channelId: c.id, ok: false, error: out.error, unknown: out.unknown },
    );
  }
  // Fake runs never reach Buffer, so they stay out of the usage log.
  if (!fakeMode()) await logDrafts(
    g.session.userId,
    results.map((r) => ({ service: channels.find((c) => c.id === r.channelId)?.service ?? "unknown", ok: r.ok, error: r.error, mode: intent })),
  );
  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: okCount > 0, results }, { status: okCount > 0 ? 200 : 502 });
}
