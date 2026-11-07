import { NextRequest, NextResponse } from "next/server";
import { prepareCreation, openCreation } from "@/lib/creationRequest";
import { deleteRun, getRun, putRun, runStatus } from "@/lib/currentRun";
import { requireSession } from "@/lib/guard";
import { isSameSite } from "@/lib/sameSite";
import { isCreationId, RUN_STEPS } from "@/lib/savedCreationShape";
import { getCreationBySource } from "@/lib/savedCreations";

// The current run: the one run of the flow kept for this account as it goes, so another device can carry on (see src/lib/currentRun.ts).
const noStore = { "Cache-Control": "no-store" };
const fail = (status: number, error: string, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status, headers: noStore });

/**
 * GET: where the run stands, cheaply (no issue is loaded): `{ run, unsaved, hasSavedForIssue }`, with `run` null when there is none.
 * GET ?open=1: the run itself, ready to put back (the issue is read again and picks it no longer has are left out).
 */
export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  try {
    if (req.nextUrl.searchParams.get("open") === "1") {
      const run = await getRun(auth.session.userId);
      if (!run) return fail(404, "There is no run to continue.");
      const opened = await openCreation(run);
      if ("error" in opened) return fail(opened.status, opened.error);
      let savedUpdatedAt: string | null = null;
      if (run.savedId) {
        const saved = await getCreationBySource(auth.session.userId, run.source);
        if (saved && saved.id === run.savedId) savedUpdatedAt = saved.updatedAt;
      }
      return NextResponse.json({ creation: { ...opened.creation, savedId: savedUpdatedAt ? run.savedId : null, savedUpdatedAt } }, { headers: noStore });
    }
    return NextResponse.json(await runStatus(auth.session.userId), { headers: noStore });
  } catch (e) {
    console.error("reading the current run failed:", (e as Error).message);
    return fail(503, "Couldn't check your run right now. Try again in a moment.");
  }
}

/**
 * PUT: autosave. `ifUpdatedAt` is the time the server gave the last write this device made or loaded; if another device wrote since, the answer is 409
 * and nothing changes. `force: true` is "keep mine". `savedId` is the saved creation this run keeps up to date.
 */
export async function PUT(req: NextRequest) {
  if (!isSameSite(req)) return fail(403, "Not allowed.");
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const prepared = await prepareCreation(body, RUN_STEPS);
  if ("error" in prepared) return fail(prepared.status, prepared.error);
  try {
    const r = await putRun(auth.session.userId, prepared.input, {
      ifUpdatedAt: typeof body.ifUpdatedAt === "string" ? body.ifUpdatedAt : null,
      force: body.force === true,
      savedId: isCreationId(body.savedId) ? body.savedId : null,
    });
    if ("conflict" in r) return fail(409, "The saved run doesn't match this screen.", { serverUpdatedAt: r.conflict });
    return NextResponse.json({ ok: true, updatedAt: r.updatedAt }, { headers: noStore });
  } catch (e) {
    console.error("saving the current run failed:", (e as Error).message);
    return fail(503, "Couldn't save your run right now.");
  }
}

/** DELETE: discard the run ("Discard and continue", "Start over"). */
export async function DELETE(req: NextRequest) {
  if (!isSameSite(req)) return fail(403, "Not allowed.");
  const auth = await requireSession(req);
  if ("response" in auth) return auth.response;
  try {
    await deleteRun(auth.session.userId);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    console.error("discarding the current run failed:", (e as Error).message);
    return fail(503, "Couldn't discard it right now. Try again in a moment.");
  }
}
