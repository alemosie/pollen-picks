import type { Chunk } from "@/lib/pollen/chunks";
import { parseWhen } from "@/lib/pollen/dates";
import type { CaptionItem } from "@/lib/caption";
import type { PickEdit } from "./options";
import type { SlideItem } from "./types";

/** Picked chunk ids (in pick order) -> slide items. */
export function slideItemsFor(chunks: Chunk[], ids: number[]): SlideItem[] {
  const byId = new Map(chunks.map((c) => [c.id, c]));
  return ids
    .map((id) => byId.get(id))
    .filter((c): c is Chunk => !!c)
    .map((c) => ({ id: c.id, title: c.title, group: c.group, when: c.when, place: c.place, blurb: c.kind === "paragraph" ? c.text : c.blurb }));
}

/** Picked chunk ids (in pick order) -> caption items, with click rank and first date for sorting. `reference` = issue date (YYYY-MM-DD). */
export function captionItemsFor(chunks: (Chunk & { rank?: number | null })[], ids: number[], reference: string, edits?: Record<number, PickEdit>): CaptionItem[] {
  const byId = new Map(chunks.map((c) => [c.id, c]));
  return ids
    .map((id) => byId.get(id))
    .filter((c): c is Chunk & { rank?: number | null } => !!c)
    .map((c) => {
      const e = edits?.[c.id];
      const when = e?.when !== undefined ? e.when || null : c.when;
      const p = when ? parseWhen(when, reference) : null;
      return { title: e?.title?.trim() || c.title, when, place: e?.place !== undefined ? e.place || null : c.place, rank: c.rank ?? null, date: p?.dates[0] ?? null, time: p?.startTime };
    });
}
