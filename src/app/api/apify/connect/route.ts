import { NextRequest, NextResponse } from "next/server";
import { deleteApifyConnection, saveApifyKey } from "@/lib/connections";
import { requireSession } from "@/lib/guard";
import { checkApifyKey, cleanApifyKey } from "@/lib/instagramHandles";

// Save or remove the signed-in user's own Apify token (used for their Instagram lookups once the free ones are used).
// The response never contains the token: only its last four characters.

const noStore = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });

export async function POST(req: NextRequest) {
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;

  const body = (await req.json().catch(() => null)) as { key?: unknown } | null;
  if (typeof body?.key !== "string" || !body.key.trim()) return fail("Paste your Apify token first.", 400);
  const key = cleanApifyKey(body.key);
  if (!key) return fail("That doesn't look like an Apify token. Copy the whole token from Apify's Integrations page.", 400);

  const check = await checkApifyKey(key);
  if (check === "invalid") return fail("Apify didn't accept that token. Copy it again from Apify's Integrations page.", 400);
  if (check === "failed") return fail("Couldn't reach Apify to check the token. Try again in a moment.", 502);

  try {
    return NextResponse.json({ connected: true, ...(await saveApifyKey(auth.session.userId, key)) }, { headers: noStore });
  } catch (e) {
    // Database trouble: the details stay in the server log (the token is never part of them).
    console.error("Apify token save failed:", (e as Error).message);
    return fail("Couldn't save the token. Try again in a moment.", 503);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  try {
    await deleteApifyConnection(auth.session.userId);
    return NextResponse.json({ connected: false }, { headers: noStore });
  } catch (e) {
    console.error("Apify token removal failed:", (e as Error).message);
    return fail("Couldn't remove the token. Try again in a moment.", 503);
  }
}
