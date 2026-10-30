import type { Chunk } from "@/lib/pollen/chunks";
import type { SlideItem } from "./types";

/** Picked chunk ids (in pick order) -> slide items. */
export function slideItemsFor(chunks: Chunk[], ids: number[]): SlideItem[] {
  const byId = new Map(chunks.map((c) => [c.id, c]));
  return ids
    .map((id) => byId.get(id))
    .filter((c): c is Chunk => !!c)
    .map((c) => ({ title: c.title, group: c.group, when: c.when, place: c.place, blurb: c.kind === "paragraph" ? c.text : c.blurb }));
}
