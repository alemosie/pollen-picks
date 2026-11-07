import { NextRequest, NextResponse } from "next/server";
import { openCreation, prepareCreation } from "@/lib/creationRequest";
import { requireSession } from "@/lib/guard";
import { isSameSite } from "@/lib/sameSite";
import { isCreationId, SAVED_STEPS } from "@/lib/savedCreationShape";
import { deleteCreation, getCreation, updateCreation } from "@/lib/savedCreations";

// One saved creation, for its owner only: GET opens it (everything the steps need to carry on), PATCH keeps it up to date as the person works, DELETE removes it.
const noStore = { "Cache-Control": "no-store" };
const fail = (status: number, error: string, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status, headers: noStore });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  const id = (await params).id;
  if (!isCreationId(id)) return fail(404, "Not found.");
  try {
    const c = await getCreation(auth.session.userId, id);
    if (!c) return fail(404, "That saved creation is gone.");
    const opened = await openCreation(c);
    if ("error" in opened) return fail(opened.status, opened.error);
    return NextResponse.json({ creation: opened.creation }, { headers: noStore });
  } catch (e) {
    console.error("opening a saved creation failed:", (e as Error).message);
    return fail(503, "Couldn't open it right now. Try again in a moment.");
  }
}

/**
 * Autosave into a creation the person saved. It only updates: a deleted creation answers 404 and stays deleted. The writer sends the `updatedAt` it last saw;
 * if the creation changed since (another device), the answer is 409 and nothing changes. `force: true` is "keep mine".
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameSite(req)) return fail(403, "Not allowed.");
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  const id = (await params).id;
  if (!isCreationId(id)) return fail(404, "Not found.");
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const prepared = await prepareCreation(body, SAVED_STEPS);
  if ("error" in prepared) return fail(prepared.status, prepared.error);
  try {
    const r = await updateCreation(auth.session.userId, id, prepared.input, typeof body.ifUpdatedAt === "string" ? body.ifUpdatedAt : null, body.force === true);
    if (r === "gone") return fail(404, "That saved creation was deleted.");
    if (typeof r === "object" && "conflict" in r) return fail(409, "The saved creation doesn't match this screen.", { serverUpdatedAt: r.conflict });
    return NextResponse.json({ ok: true, updatedAt: r.updatedAt }, { headers: noStore });
  } catch (e) {
    console.error("updating a saved creation failed:", (e as Error).message);
    return fail(503, "Couldn't save right now.");
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameSite(req)) return fail(403, "Not allowed.");
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  const id = (await params).id;
  if (!isCreationId(id)) return fail(404, "Not found.");
  try {
    await deleteCreation(auth.session.userId, id);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    console.error("deleting a saved creation failed:", (e as Error).message);
    return fail(503, "Couldn't delete it right now. Try again in a moment.");
  }
}
