// What a send is called in History: the title of its first pick, or its description cut short when the pick has no title (a title emptied on purpose
// in the design counts as none). Two sends of the same issue share the issue's title, so this is what tells them apart. Worked out from the slides
// as they were laid out when the send was queued, so it matches what the person saw on the Design step.

import type { Slide } from "./types";

/** The longest title kept (the column allows 200). */
export const POST_TITLE_MAX = 200;
/** A description stands in for a missing title, so it is cut shorter: a line of it, not a paragraph. */
export const POST_DESCRIPTION_MAX = 100;

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

/** Cuts at a word where it can, and says so with an ellipsis. */
function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max - 1);
  const at = head.lastIndexOf(" ");
  return `${(at > max * 0.6 ? head.slice(0, at) : head).replace(/[\s,;:.\-–—]+$/, "")}…`;
}

/** The first pick's title, else its description cut short, else "" (a send without any words, which History then names by its issue). */
export function postTitleOf(slides: Slide[]): string {
  for (const slide of slides) {
    if (slide.kind !== "picks") continue;
    for (const item of slide.items) {
      const title = tidy(item.title);
      if (title) return cut(title, POST_TITLE_MAX);
      const blurb = tidy(item.blurb ?? "");
      if (blurb) return cut(blurb, POST_DESCRIPTION_MAX);
    }
  }
  return "";
}
