import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { allowFetch } from "@/lib/publicFetch";
import { isSameSite } from "@/lib/sameSite";
import { deleteAllPhotoLinks, listPhotoLinks, savePhotoLink } from "@/lib/userPhotoLinks";

// The picture links the signed-in user saved for their slides. GET lists them ({ photos: [{ id, url }] }); POST saves one ({ url }, a public
// picture's address, checked by fetching it once) and answers with its id; DELETE removes all of them (Settings > Photos).
// See lib/userPhotoLinks.ts.
const noStore = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });

export async function GET(req: NextRequest) {
  if (!isSameSite(req)) return fail("Not allowed.", 403);
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json({ photos: await listPhotoLinks(auth.session.userId) }, { headers: noStore });
  } catch (e) {
    console.error("listing photo links failed:", (e as Error).message);
    return fail("Couldn't load your links. Try again in a moment.", 503);
  }
}

export async function POST(req: NextRequest) {
  if (!isSameSite(req)) return fail("Not allowed.", 403);
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  // Saving fetches the address once, so it is limited like the other places that read the web for a user.
  if (!allowFetch(`photo-link:${auth.session.userId}`)) return fail("That's a lot of links at once. Wait a few minutes and try again.", 429);
  const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
  try {
    const r = await savePhotoLink(auth.session.userId, body?.url);
    return "error" in r ? fail(r.error, r.status) : NextResponse.json({ photo: r.link }, { headers: noStore });
  } catch (e) {
    console.error("saving a photo link failed:", (e as Error).message);
    return fail("Couldn't save that link. Try again in a moment.", 503);
  }
}

export async function DELETE(req: NextRequest) {
  if (!isSameSite(req)) return fail("Not allowed.", 403);
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  try {
    await deleteAllPhotoLinks(auth.session.userId);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    console.error("removing all photo links failed:", (e as Error).message);
    return fail("Couldn't remove your links. Try again in a moment.", 503);
  }
}
