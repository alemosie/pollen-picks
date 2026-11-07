// Server-only: what the routes for saved creations and the current run have in common. The issue's title, newsletter and address come from the
// server (never from the request), and only picks that exist in that issue are kept.

import { parseCreationInput, type CreationInput, type OpenedCreation, type RunStep } from "./savedCreationShape";
import { loadAppIssue } from "./sources";

export type Prepared = { input: CreationInput } | { status: number; error: string };

/** Checks a request body against the issue it names. A caption written for picks that were dropped is not kept. */
export async function prepareCreation(body: Record<string, unknown>, steps: readonly RunStep[]): Promise<Prepared> {
  const issue = await loadAppIssue(typeof body.source === "string" ? body.source : undefined);
  if (!issue) return { status: 404, error: "This issue can't be saved: it isn't available right now." };
  const parsed = parseCreationInput({ ...body, link: issue.url, newsletter: issue.newsletter, title: issue.title }, steps);
  if ("error" in parsed) return { status: 400, error: parsed.error };
  const have = new Set(issue.chunks.map((c) => c.id));
  const picks = parsed.picks.filter((id) => have.has(id));
  if (picks.length === 0) return { status: 400, error: "Those picks aren't in this issue any more." };
  return { input: picks.length === parsed.picks.length ? parsed : { ...parsed, picks, format: null } };
}

/**
 * A stored creation or run, ready to be put back: the issue is read again and picks it no longer has are left out (`dropped` says how many).
 * The caption was written for the full set of picks, so with some gone it is not kept. Saved at Send, it then opens at Write instead.
 */
export async function openCreation(c: OpenedCreation): Promise<{ creation: OpenedCreation } | { status: number; error: string }> {
  const issue = await loadAppIssue(c.source);
  if (!issue) return { status: 409, error: "This issue can't be loaded right now. Try again in a moment." };
  const have = new Set(issue.chunks.map((x) => x.id));
  const picks = c.picks.filter((p) => have.has(p));
  if (picks.length === 0) return { status: 409, error: "None of the picks in this creation are in the issue any more." };
  const dropped = c.picks.length - picks.length;
  return { creation: { ...c, link: issue.url, picks, dropped, format: dropped > 0 ? null : c.format, step: dropped > 0 && c.step === 5 ? 4 : c.step } };
}
