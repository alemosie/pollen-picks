import { after, NextRequest, NextResponse } from "next/server";
import { MAX_TEMPLATE_CHARS } from "@/lib/savedCreationShape";
import { siteOrigin } from "@/lib/buffer";
import { effectiveIntent } from "@/lib/caption";
import { fakeMode, type PostIntent } from "@/lib/bufferPost";
import { requireSession } from "@/lib/guard";
import { serviceKey } from "@/lib/channels";
import { loadLinkedinFormat } from "@/lib/slideStyleStore";
import { loadAppIssue } from "@/lib/sources";
import { planSlides } from "@/lib/slides/plan";
import { slideItemsFor } from "@/lib/slides/items";
import { parseTemplateFrom } from "@/lib/slides/options";
import { postTitleOf } from "@/lib/slides/postTitle";
import { deleteRun } from "@/lib/currentRun";
import { enqueue, processQueue } from "@/lib/sendQueue";

/**
 * Queue a send: one row per selected channel in post_history (status 'queued'), then return at once with the batch id. The posts themselves
 * are created by the send queue (src/lib/sendQueue.ts), which doesn't depend on this page staying open: this request only starts it.
 * `intent: "draft"` (the default) saves drafts that are never published. A channel whose caption is over its network's limit is always saved as a draft, even on `intent: "now"`, so one long caption never holds up the rest. `intent: "now"` publishes immediately and must carry `confirmed: true`,
 * which the confirmation dialog sets, so a stray request can't publish anything.
 * The sample issue can't be sent: it only exists in the public /demo flow, and a request without a real `source` is refused.
 * Buffer fetches the slide images itself, so they must be publicly reachable (not localhost).
 */
export async function POST(req: NextRequest) {
  const g = await requireSession(req);
  if ("response" in g) return g.response;

  const body = (await req.json().catch(() => ({}))) as { source?: string; channels?: { id: string; service: string; name?: string }[]; picks?: number[]; caption?: string; captions?: Record<string, string>; template?: string; intent?: string; confirmed?: boolean };
  const intent: PostIntent = body.intent === "now" ? "now" : "draft";
  if (intent === "now" && body.confirmed !== true) {
    return NextResponse.json({ error: "Sending now needs confirmation." }, { status: 400 });
  }

  // Fail closed, before anything is queued. No source (or the sample issue) means no content to send.
  const issue = await loadAppIssue(body.source);
  if (!issue) {
    return NextResponse.json({ error: "The sample issue can't be sent to Buffer. Connect your own newsletter to create posts." }, { status: 403 });
  }

  // A design is never cut short on its way to Buffer (a cut-off one reads as the standard layout): too large means nothing is queued.
  if ((body.template ?? "").length > MAX_TEMPLATE_CHARS) {
    return NextResponse.json({ error: "This design is too large to send. Shorten some of the slide text, then send again. Nothing was sent." }, { status: 413 });
  }

  const picks = (body.picks ?? []).filter(Number.isFinite);
  const channels = (body.channels ?? []).filter((c) => c?.id && typeof c.service === "string");
  if (channels.length === 0) return NextResponse.json({ error: "Choose at least one channel." }, { status: 400 });
  if (channels.length > 200) return NextResponse.json({ error: "That's too many channels for one send." }, { status: 400 });
  if (picks.length === 0) return NextResponse.json({ error: "No picks." }, { status: 400 });

  const base = (process.env.PUBLIC_BASE_URL ?? siteOrigin()).replace(/\/$/, "");
  if (!fakeMode() && /localhost|127\.0\.0\.1/.test(base)) {
    return NextResponse.json({ error: `Slide images are served from ${base}, which Buffer can't reach. Use the deployed site (or set PUBLIC_BASE_URL to a tunnel).` }, { status: 400 });
  }

  // What History calls this send. Only a label: if it can't be worked out, the send goes ahead and History names it by its issue.
  let postTitle = "";
  try {
    postTitle = postTitleOf(planSlides(slideItemsFor(issue.chunks, picks), { newsletter: issue.newsletter, ...parseTemplateFrom(new URLSearchParams(body.template ?? "")) }));
  } catch (e) {
    console.error("naming the send failed:", (e as Error).message);
  }

  try {
    const { batchId } = await enqueue(g.session.userId, {
      source: body.source as string,
      picks,
      template: body.template ?? "",
      intent,
      // LinkedIn's own carousel is a PDF, so that is what a LinkedIn channel gets unless the user chose images (Settings > LinkedIn format).
      linkedinPdf: channels.some((c) => serviceKey(c.service) === "linkedin") && (await loadLinkedinFormat(g.session.userId)) === "pdf",
      newsletter: issue.newsletter,
      // The issue's or public post's title, or its link when the page has none: History shows it as where the send came from.
      issueTitle: issue.title?.trim() || issue.url,
      postTitle,
      // A caption over a network's limit is never published: that channel is saved as a draft to shorten in Buffer, and the rest go as asked.
      channels: channels.map((c) => {
        const caption = body.captions?.[c.id] ?? body.caption ?? "";
        return { id: c.id, service: c.service, name: String(c.name ?? ""), caption, intent: effectiveIntent(c.service, caption, intent) };
      }),
    });
    // The run is sent, so its copy on the server (which holds the caption) goes. The queue keeps the caption only as long as it needs it. A saved creation stays.
    await deleteRun(g.session.userId, body.source).catch((e) => console.error("discarding the sent run failed:", (e as Error).message));
    // Start sending now; whatever doesn't fit in this request is picked up by the page's progress checks and by the scheduled worker.
    const userId = g.session.userId;
    after(() => processQueue({ userId, limit: 6, deadlineMs: 8_000 }).then(() => undefined));
    return NextResponse.json({ ok: true, batchId });
  } catch (e) {
    console.error("queueing the send failed:", (e as Error).message);
    return NextResponse.json({ error: "Couldn't start the send. Nothing was sent. Try again in a moment." }, { status: 503 });
  }
}
