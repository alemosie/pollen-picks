import type { SlideItem } from "./slides/types";
import { stripEmoji } from "./slides/plan";

/** Plain-template caption for the carousel (no LLM). Editable in the UI before the draft is created. */
export function buildCaption(items: SlideItem[], opts: { newsletter: string; heading?: string }): string {
  const lines = items.slice(0, 10).map((i) => {
    const meta = [i.when, i.place].filter(Boolean).map((s) => stripEmoji(String(s))).join(" · ");
    return `• ${stripEmoji(i.title)}${meta ? ` (${meta})` : ""}`;
  });
  const more = items.length > 10 ? `\n…and ${items.length - 10} more` : "";
  return [
    `${opts.heading ?? "This week's picks"} from ${opts.newsletter} 🌼`,
    "",
    "Swipe through ➡️",
    "",
    lines.join("\n") + more,
    "",
    "Every pick, with details, is in the newsletter. Link in bio.",
  ].join("\n");
}
