import { NextRequest, NextResponse } from "next/server";
import { BeehiivKeyError, checkKey, cleanKey, cleanLogoUrl, looksLikeKey } from "@/lib/beehiiv";
import { deleteBeehiivConnection, getBeehiivConnection, saveBeehiivKey, setPublicationLogo } from "@/lib/connections";
import { isPublicationId } from "@/lib/flow";
import { requireSession } from "@/lib/guard";

// Save or remove the signed-in user's beehiiv API key.
// The response never contains the key: only the last four characters and the publications beehiiv reported.

const noStore = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;

  const body = (await req.json().catch(() => null)) as { key?: unknown } | null;
  const key = cleanKey(body?.key);
  if (!key) return NextResponse.json({ error: "Paste your beehiiv API key first." }, { status: 400, headers: noStore });
  if (!looksLikeKey(key)) {
    return NextResponse.json({ error: "That doesn't look like a beehiiv API key. Copy the whole key from beehiiv's API page." }, { status: 400, headers: noStore });
  }

  try {
    const publications = await checkKey(key);
    // A logo the user set by hand survives re-saving the key when beehiiv doesn't supply one.
    const before = await getBeehiivConnection(auth.session.userId);
    for (const p of publications) p.logo ??= before?.publications.find((b) => b.id === p.id)?.logo;
    const saved = await saveBeehiivKey(auth.session.userId, key, publications);
    return NextResponse.json({ connected: true, ...saved }, { headers: noStore });
  } catch (e) {
    if (e instanceof BeehiivKeyError) {
      const status = e.kind === "invalid" || e.kind === "no-publications" ? 400 : e.kind === "rate-limited" ? 429 : 502;
      return NextResponse.json({ error: e.message }, { status, headers: noStore });
    }
    // Database trouble: the details stay in the server log (the key is never part of them).
    console.error("beehiiv connect failed:", (e as Error).message);
    return NextResponse.json({ error: "Couldn't save the key. Try again in a moment." }, { status: 503, headers: noStore });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  try {
    await deleteBeehiivConnection(auth.session.userId);
    return NextResponse.json({ connected: false }, { headers: noStore });
  } catch (e) {
    console.error("beehiiv disconnect failed:", (e as Error).message);
    return NextResponse.json({ error: "Couldn't remove the key. Try again in a moment." }, { status: 503, headers: noStore });
  }
}

/** Set or clear a publication's logo: { publication: "pub_…", logo: "https://…" | "" }. */
export async function PATCH(req: NextRequest) {
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  const body = (await req.json().catch(() => null)) as { publication?: unknown; logo?: unknown } | null;
  const publication = typeof body?.publication === "string" ? body.publication : "";
  if (!isPublicationId(publication)) return NextResponse.json({ error: "Unknown publication." }, { status: 400, headers: noStore });
  const clear = typeof body?.logo === "string" && body.logo.trim() === "";
  const logo = clear ? null : (cleanLogoUrl(body?.logo) ?? undefined);
  if (logo === undefined) return NextResponse.json({ error: "Paste a full image link that starts with https://" }, { status: 400, headers: noStore });
  try {
    const publications = await setPublicationLogo(auth.session.userId, publication, logo);
    if (!publications) return NextResponse.json({ error: "That publication isn't connected." }, { status: 404, headers: noStore });
    return NextResponse.json({ publications }, { headers: noStore });
  } catch (e) {
    console.error("beehiiv logo save failed:", (e as Error).message);
    return NextResponse.json({ error: "Couldn't save the logo. Try again in a moment." }, { status: 503, headers: noStore });
  }
}
