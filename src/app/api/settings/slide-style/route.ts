import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { loadSlideStyle, resetSlideStyle, saveSlideStyle } from "@/lib/slideStyleStore";
import { settingsPreviews } from "@/lib/slides/settingsPreview";
import { cleanStyle, DEFAULT_STYLE } from "@/lib/slides/style";

// Settings > Slide style and Settings > Organization: save (PUT, any of the fields) or reset the header, footer and font (DELETE) of the signed-in user's style. Both answer with the addresses of fresh
// preview slides, so the screen can show the result straight away.

const noStore = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });

export async function PUT(req: NextRequest) {
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  // The body is a few small fields, plus a logo of at most 250 000 characters; anything much bigger is not ours.
  if (Number(req.headers.get("content-length") ?? 0) > 400_000) return fail("That's too large.", 413);
  const body = await req.json().catch(() => null);
  const uid = auth.session.userId;
  try {
    const saved = await loadSlideStyle(uid);
    const style = cleanStyle(body, saved?.style ?? DEFAULT_STYLE);
    if (!style) return fail("Those settings aren't valid. A logo must be a PNG or JPEG under 250 KB.", 400);
    const version = await saveSlideStyle(uid, style);
    return NextResponse.json({ version, previews: settingsPreviews(uid, version, saved?.palette?.[0]) }, { headers: noStore });
  } catch (e) {
    console.error("saving the slide style failed:", (e as Error).message);
    return fail("Couldn't save. Try again in a moment.", 503);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  const uid = auth.session.userId;
  try {
    // Back to the standard header, footer and font. The organization and the palette have their own screens and are kept.
    const palette = (await loadSlideStyle(uid))?.palette;
    const version = await resetSlideStyle(uid);
    return NextResponse.json({ previews: settingsPreviews(uid, version, palette?.[0]) }, { headers: noStore });
  } catch (e) {
    console.error("resetting the slide style failed:", (e as Error).message);
    return fail("Couldn't reset. Try again in a moment.", 503);
  }
}
