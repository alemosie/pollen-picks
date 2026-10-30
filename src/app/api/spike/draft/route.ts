import { NextRequest, NextResponse } from "next/server";
import { gql } from "@/lib/buffer";
import { requireSession } from "@/lib/guard";

const DEFAULT_IMAGES = ["https://placehold.co/1080x1350.png?text=Slide+1", "https://placehold.co/1080x1350.png?text=Slide+2"];

// Spike: create a multi-image draft on one channel and return Buffer's raw answer.
export async function POST(req: NextRequest) {
  const g = await requireSession(req);
  if ("response" in g) return g.response;
  const { channelId, service } = (await req.json()) as { channelId?: string; service?: string };
  if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });

  const fromEnv = (process.env.SPIKE_IMAGE_URLS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const images = fromEnv.length ? fromEnv : DEFAULT_IMAGES; // an empty env var must fall back too
  const assets = images.map((u) => `{ image: { url: ${JSON.stringify(u)} } }`).join(", ");
  const text = JSON.stringify("Spike test draft from beehiiv-to-buffer (Buffer Commit). Safe to delete.");

  // Instagram needs an explicit post type; a multi-image "post" is a carousel.
  const metadata = service === "instagram" ? "metadata: { instagram: { type: post, shouldShareToFeed: true } }" : "";

  const query = `mutation {
    createPost(input: {
      text: ${text}
      channelId: ${JSON.stringify(channelId)}
      schedulingType: automatic
      mode: addToQueue
      saveToDraft: true
      ${metadata}
      assets: [${assets}]
    }) {
      ... on PostActionSuccess { post { id text dueAt assets { id mimeType } } }
      ... on MutationError { message }
    }
  }`;
  const result = await gql(g.session.accessToken, query);
  return NextResponse.json({ sentImages: images, result });
}
