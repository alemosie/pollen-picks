import { NextRequest, NextResponse } from "next/server";
import { gql } from "@/lib/buffer";
import { requireSession } from "@/lib/guard";
import { loadDemoIssue } from "@/lib/demo";
import { planSlides } from "@/lib/slides/plan";
import { slideItemsFor } from "@/lib/slides/items";

/**
 * Demo mode: create a Buffer draft (never published) from picked demo chunks.
 * Buffer fetches the slide images itself, so the URLs must be publicly reachable (not localhost).
 */
export async function POST(req: NextRequest) {
  const g = await requireSession(req);
  if ("response" in g) return g.response;

  const body = (await req.json().catch(() => ({}))) as { channelId?: string; service?: string; picks?: number[]; caption?: string };
  const picks = (body.picks ?? []).filter(Number.isFinite);
  if (!body.channelId) return NextResponse.json({ error: "Choose a channel." }, { status: 400 });
  if (picks.length === 0) return NextResponse.json({ error: "No picks." }, { status: 400 });

  const base = (process.env.PUBLIC_BASE_URL ?? req.nextUrl.origin).replace(/\/$/, "");
  if (/localhost|127\.0\.0\.1/.test(base)) {
    return NextResponse.json({ error: `Slide images are served from ${base}, which Buffer can't reach. Use the deployed site (or set PUBLIC_BASE_URL to a tunnel).` }, { status: 400 });
  }

  const issue = loadDemoIssue();
  const slides = planSlides(slideItemsFor(issue.chunks, picks), { newsletter: "Just a Phase" });
  const q = picks.join(",");
  const images = slides.map((_, i) => `${base}/api/slide/preview?picks=${q}&n=${i}`);
  const assets = images.map((u) => `{ image: { url: ${JSON.stringify(u)} } }`).join(", ");
  const text = JSON.stringify(body.caption ?? "");
  const metadata = body.service === "instagram" ? "metadata: { instagram: { type: post, shouldShareToFeed: true } }" : "";

  const query = `mutation {
    createPost(input: {
      text: ${text}
      channelId: ${JSON.stringify(body.channelId)}
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
  const r = await gql<{ createPost: { post?: { id: string }; message?: string } }>(g.session.accessToken, query);
  const cp = r.data?.createPost;
  if (r.errors?.length || !cp?.post) {
    return NextResponse.json({ error: cp?.message ?? r.errors?.[0]?.message ?? `Buffer returned ${r.status}`, images }, { status: 502 });
  }
  return NextResponse.json({ ok: true, postId: cp.post.id, slides: images.length });
}
