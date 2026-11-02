import { stripEmoji } from "./slides/plan";

/** What a caption line needs from a pick. `date` is the first ISO date (YYYY-MM-DD) found in its date line. */
export type CaptionItem = { title: string; when: string | null; place: string | null; rank: number | null; date: string | null; time?: string };
export type CaptionOrder = "clicks" | "alpha" | "date";
/** `bullet` starts every line of that ordering's caption; change them here. */
export const CAPTION_ORDERS: { id: CaptionOrder; label: string; bullet: string; hint: string }[] = [
  { id: "clicks", label: "Clicks", bullet: "🔥", hint: "Most-clicked picks first" },
  { id: "alpha", label: "A–Z", bullet: "➡️", hint: "Alphabetical by title" },
  { id: "date", label: "Date", bullet: "🗓️", hint: "Soonest first, with the date up front" },
];
const bulletFor = (order: CaptionOrder) => CAPTION_ORDERS.find((o) => o.id === order)!.bullet;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-10-20" -> "Tue 20 Oct" (calendar arithmetic only, no timezone). */
export function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}

const MAX_LINES = 10;
/** Emoji stay in captions (every network renders them); only whitespace is tidied. */
const cleanText = (s: string) => s.replace(/\s+/g, " ").trim();
/** "Thu 22 Oct @ 09:30-10:30 (Weekly)" -> without the recurrence note, which the caption doesn't need. */
const cleanWhen = (s: string) => cleanText(s).replace(/\s*\((weekly|every[^)]*)\)/i, "").trim();

const byRank = (a: CaptionItem, b: CaptionItem) => (a.rank ?? Infinity) - (b.rank ?? Infinity);
// Sort on the words, so a leading emoji doesn't push a pick to the top of A–Z.
const byTitle = (a: CaptionItem, b: CaptionItem) => stripEmoji(a.title).localeCompare(stripEmoji(b.title), "en", { sensitivity: "base" });
const byDate = (a: CaptionItem, b: CaptionItem) =>
  (a.date ?? "9999").localeCompare(b.date ?? "9999") || (a.time ?? "99:99").localeCompare(b.time ?? "99:99") || byTitle(a, b);

export function sortCaptionItems(items: CaptionItem[], order: CaptionOrder): CaptionItem[] {
  const cmp = order === "clicks" ? byRank : order === "alpha" ? byTitle : byDate;
  // Array.sort is stable, so ties keep the order the picks were made in.
  return [...items].sort(cmp);
}

function line(i: CaptionItem, order: CaptionOrder): string {
  const title = cleanText(i.title);
  const place = i.place ? ` (${cleanText(i.place)})` : "";
  const bullet = bulletFor(order);
  // By date: a pick without a date has no day to show, so it gets a plain bullet instead.
  if (order === "date") return i.date ? `${bullet} ${dayLabel(i.date)}: ${title}${place}` : `• ${title}${place}`;
  const when = i.when ? cleanWhen(i.when) : "";
  return `${bullet} ${title}${when ? ` — ${when}` : ""}${place}`;
}

export const isInstagram = (service: string) => service.toLowerCase().replace(/[^a-z]/g, "") === "instagram";

/** The two base captions: Instagram has no clickable links in captions, so it points to the bio; every other network gets the newsletter URL. */
export type CaptionVariant = "instagram" | "link";
export const CAPTION_VARIANTS: { id: CaptionVariant; label: string; note: string }[] = [
  { id: "instagram", label: "Instagram", note: "No direct link: links aren't clickable in Instagram captions, so it points to the bio." },
  { id: "link", label: "Other platforms", note: "Includes the direct newsletter link." },
];
export const variantFor = (service: string): CaptionVariant => (isInstagram(service) ? "instagram" : "link");

/** Plain-template caption (no LLM). */
export function buildCaption(items: CaptionItem[], opts: { newsletter: string; heading?: string; order: CaptionOrder; variant: CaptionVariant; link: string }): string {
  const sorted = sortCaptionItems(items, opts.order);
  const lines = sorted.slice(0, MAX_LINES).map((i) => line(i, opts.order));
  const more = sorted.length > MAX_LINES ? `\n…and ${sorted.length - MAX_LINES} more` : "";
  const outro = opts.variant === "link" ? `Read it here: ${opts.link}` : "Link in bio.";
  return [`${opts.heading ?? "This week's picks"} from ${opts.newsletter} 🌼`, "", lines.join("\n") + more, "", `Details on every pick are in the newsletter. ${outro}`].join("\n");
}
