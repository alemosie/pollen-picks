import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/guard";
import { LINKEDIN_FORMATS } from "@/lib/linkedinFormat";
import { saveLinkedinFormat } from "@/lib/slideStyleStore";

// Settings > LinkedIn format: save (PUT { format: "pdf" | "images" }) the signed-in user's choice.

const noStore = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });

export async function PUT(req: NextRequest) {
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  const body = (await req.json().catch(() => null)) as { format?: unknown } | null;
  const format = LINKEDIN_FORMATS.find((f) => f === body?.format);
  if (!format) return fail("Choose a PDF carousel or separate images.", 400);
  try {
    await saveLinkedinFormat(auth.session.userId, format);
    return NextResponse.json({ saved: true, format }, { headers: noStore });
  } catch (e) {
    console.error("saving the LinkedIn format failed:", (e as Error).message);
    return fail("Couldn't save. Try again in a moment.", 503);
  }
}
