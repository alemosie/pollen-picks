import { serviceKey } from "./channels";
import { stripEmoji } from "./slides/plan";

/** What a caption line needs from a pick. `date` is the first ISO date (YYYY-MM-DD) found in its date line. `tag` is the Instagram handle (no "@") its link points to. */
export type CaptionItem = { title: string; when: string | null; place: string | null; rank: number | null; date: string | null; time?: string; tag?: string | null; /** Category label, e.g. "West". */ group?: string };
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

/** Instagram's caption limit (2,196 per Buffer's docs). Counted in UTF-16 units, so emoji count double: on the safe side. */
export const MAX_CAPTION_CHARS = 2196;
/**
 * Caption limits per network (Buffer's docs, https://developers.buffer.com/guides/character-limits.md). X is treated as the free
 * 280 (Buffer doesn't say who has Premium). Mastodon's limit varies by server; 500 is the usual one.
 */
export const CHAR_LIMITS: Record<string, number> = { instagram: 2196, linkedin: 3000, facebook: 5000, twitter: 280, x: 280, bluesky: 300, threads: 500, mastodon: 500 };
/** The networks that get the short caption (the rest of the text networks get the base one). */
const SHORT_NETWORKS = new Set(["twitter", "x", "bluesky", "threads", "mastodon"]);
/** What a variant's caption is cut to when no network says otherwise. */
const DEFAULT_LIMIT: Record<string, number> = { instagram: MAX_CAPTION_CHARS, link: 2200, short: 280 };
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

/** Ends the line of a pick whose link is an Instagram account. An @mention is only a tag on Instagram, so no other network gets it. */
export const fromTag = (tag: string | null | undefined, variant: CaptionVariant) => (variant === "instagram" && tag ? ` · From @${tag}` : "");

function line(i: CaptionItem, order: CaptionOrder, variant: CaptionVariant): string {
  const title = cleanText(i.title);
  const place = i.place ? ` (${cleanText(i.place)})` : "";
  const from = fromTag(i.tag, variant);
  const bullet = bulletFor(order);
  const cat = i.group ? ` · ${cleanText(i.group)}` : "";
  // Short captions have room for titles, and a day when one is known.
  if (variant === "short") return `${bullet} ${title}${i.date ? ` (${dayLabel(i.date)})` : ""}`;
  // By date: a pick without a date has no day to show, so it gets a plain bullet instead.
  if (order === "date") return i.date ? `${bullet} ${dayLabel(i.date)}: ${title}${place}${cat}${from}` : `• ${title}${place}${cat}${from}`;
  const when = i.when ? cleanWhen(i.when) : "";
  return `${bullet} ${title}${when ? ` — ${when}` : ""}${place}${cat}${from}`;
}

export const isInstagram = (service: string) => service.toLowerCase().replace(/[^a-z]/g, "") === "instagram";

/**
 * The captions: Instagram has no clickable links in captions, so it points to the bio. "Base" is the long one for networks with room
 * (LinkedIn, Facebook), with the newsletter URL. "Short" is for X, Bluesky, Threads and Mastodon: a few titles and the link.
 */
export type CaptionVariant = "instagram" | "link" | "short";
export const CAPTION_VARIANTS: { id: CaptionVariant; label: string; note: string }[] = [
  { id: "instagram", label: "Instagram", note: "No direct link: links aren't clickable in Instagram captions, so it points to the bio." },
  { id: "link", label: "Base", note: "The long version, with the direct newsletter link." },
  { id: "short", label: "Short", note: "A few titles and the direct link, short enough for the networks with the tightest limits. The link is counted in full." },
];
export const variantFor = (service: string): CaptionVariant => (isInstagram(service) ? "instagram" : SHORT_NETWORKS.has(serviceKey(service)) ? "short" : "link");
/** One network's own limit, if known. */
export const limitOf = (service: string): number | undefined => CHAR_LIMITS[serviceKey(service)];
/** The room a variant's caption has: the tightest limit among the networks that use it (`services` = their Buffer services). */
export function variantLimit(variant: CaptionVariant, services: string[]): number {
  const own = services.filter((s) => variantFor(s) === variant).map(limitOf).filter((n): n is number => n !== undefined);
  return own.length > 0 ? Math.min(...own) : DEFAULT_LIMIT[variant];
}

type CaptionOpts = { /** Most characters the caption may have; defaults to the variant's usual limit. */ limit?: number; newsletter: string; /** Content from someone else's public post: every caption links to the original (Instagram too, as text). */ creditLink?: boolean; /** Credited after the newsletter name when the page names one. */ author?: string | null; heading?: string; order: CaptionOrder; variant: CaptionVariant; link: string };

/** The caption, and the titles of the picks that didn't fit in it (in caption order). */
function fitCaption(items: CaptionItem[], opts: CaptionOpts): { text: string; leftOut: string[] } {
  const sorted = sortCaptionItems(items, opts.order);
  const all = sorted.map((i) => line(i, opts.order, opts.variant));
  const outro = opts.creditLink ? `Read the original post: ${opts.link}` : opts.variant !== "instagram" ? `Read it here: ${opts.link}` : "Link in bio.";
  const head = `${opts.heading ?? "This week's picks"} from ${opts.newsletter}${opts.author ? ` by ${opts.author}` : ""} 🌼`;
  const foot = opts.creditLink || opts.variant === "short" ? outro : `Details on every pick are in the newsletter. ${outro}`;
  // By date with a mix of dated and undated picks: the dated ones first, then the rest under "Other picks:" (dated sort first).
  const datedCount = opts.order === "date" ? sorted.filter((i) => i.date).length : 0;
  const mixed = opts.variant !== "short" && datedCount > 0 && datedCount < sorted.length;
  const list = (n: number) => {
    if (!mixed) return all.slice(0, n).join("\n");
    const dated = all.slice(0, Math.min(n, datedCount)).join("\n");
    const other = all.slice(datedCount, n);
    return other.length ? `${dated}${dated ? "\n\n" : ""}Other picks:\n\n${other.join("\n")}` : dated;
  };
  const build = (n: number) => {
    const more = all.length - n;
    return [head, "", list(n) + (more > 0 ? `\n…and ${more} more` : ""), "", foot].join("\n");
  };
  // Every pick goes in while the caption fits; otherwise as many as fit, then "…and N more". At least one always stays.
  const limit = opts.limit ?? DEFAULT_LIMIT[opts.variant];
  let n = all.length;
  while (n > 1 && build(n).length > limit) n--;
  return { text: build(n), leftOut: sorted.slice(n).map((i) => cleanText(i.title)) };
}

/** Plain-template caption (no LLM). */
export const buildCaption = (items: CaptionItem[], opts: CaptionOpts): string => fitCaption(items, opts).text;

/** Titles of the picks the template caption has to leave out to stay within its limit. */
export const captionLeftOut = (items: CaptionItem[], opts: CaptionOpts): string[] => fitCaption(items, opts).leftOut;
