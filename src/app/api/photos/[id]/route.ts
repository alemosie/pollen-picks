import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { isSameSite } from "@/lib/sameSite";
import { deletePhotoLink } from "@/lib/userPhotoLinks";

// One saved picture link, for its owner only: DELETE removes it.
const noStore = { "Cache-Control": "no-store" };

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameSite(req)) return NextResponse.json({ error: "Not allowed." }, { status: 403, headers: noStore });
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  try {
    await deletePhotoLink(auth.session.userId, (await params).id);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    console.error("removing a photo link failed:", (e as Error).message);
    return NextResponse.json({ error: "Couldn't remove that link. Try again in a moment." }, { status: 503, headers: noStore });
  }
}
