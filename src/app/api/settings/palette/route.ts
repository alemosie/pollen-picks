import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { DEFAULT_PALETTE, isHex, MAX_COLORS, MIN_COLORS } from "@/lib/palette";
import { savePaletteFor } from "@/lib/slideStyleStore";

// Settings > Slide colors: save (PUT { colors }) or reset (DELETE) the signed-in user's palette.
// A reset is saved as the standard palette itself, not as "nothing": "nothing" means the user never saved one, which is when a browser's own
// palette is imported. Saved as nothing, another browser that still holds the old colors would send them straight back up.

const noStore = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });

export async function PUT(req: NextRequest) {
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  const body = (await req.json().catch(() => null)) as { colors?: unknown } | null;
  const colors = body?.colors;
  if (!Array.isArray(colors) || colors.length < MIN_COLORS || colors.length > MAX_COLORS || !colors.every((c) => typeof c === "string" && isHex(c)))
    return fail(`A palette is ${MIN_COLORS} to ${MAX_COLORS} colors like #f6bd60.`, 400);
  try {
    await savePaletteFor(auth.session.userId, (colors as string[]).map((c) => c.toLowerCase()));
    return NextResponse.json({ saved: true }, { headers: noStore });
  } catch (e) {
    console.error("saving the palette failed:", (e as Error).message);
    return fail("Couldn't save the palette. Try again in a moment.", 503);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  try {
    await savePaletteFor(auth.session.userId, DEFAULT_PALETTE);
    return NextResponse.json({ saved: true }, { headers: noStore });
  } catch (e) {
    console.error("resetting the palette failed:", (e as Error).message);
    return fail("Couldn't reset the palette. Try again in a moment.", 503);
  }
}
