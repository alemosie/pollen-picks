import { serviceKey, serviceLabel } from "./channels";
import { stripEmoji } from "./slides/plan";
import type { PostIntent } from "./bufferPost";

/** What a caption line needs from a pick. `date` is the first ISO date (YYYY-MM-DD) found in its date line. `tag` is the Instagram handle (no "@") its link points to. */
export type CaptionItem = { title: string; when: string | null; place: string | null; rank: number | null; date: string | null; /** Last day of a multi-day pick (YYYY-MM-DD). */ endDate?: string | null; time?: string; tag?: string | null; /** Category label, e.g. "West". */ group?: string; /** Who to credit for the picture on this pick's slide ("@handle", a site's name). Goes in the caption, not on the slide. */ photoCredit?: string };
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

/** "2026-11-09","2026-11-11" -> "9-11 Nov"; across months "30 Oct-2 Nov"; one day (no end) -> "Wed 11 Nov". */
export function rangeLabel(start: string, end?: string | null): string {
  if (!end || end <= start) return dayLabel(start);
  const [, m1, d1] = start.split("-").map(Number);
  const [, m2, d2] = end.split("-").map(Number);
  return m1 === m2 ? `${d1}-${d2} ${MONTHS[m2 - 1]}` : `${d1} ${MONTHS[m1 - 1]}-${d2} ${MONTHS[m2 - 1]}`;
}

/** The emoji a title starts with (the pick's own), if any. */
const LEAD_EMOJI = /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*/u;
const splitLeadEmoji = (title: string): { emoji: string | null; rest: string } => {
  const m = title.match(LEAD_EMOJI);
  return m ? { emoji: m[1], rest: title.slice(m[0].length) } : { emoji: null, rest: title };
};

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

/** Follows a pick's title when its link is an Instagram account (" @handle"). An @mention is only a tag on Instagram, so no other network gets it. */
export const fromTag = (tag: string | null | undefined, variant: CaptionVariant) => (variant === "instagram" && tag ? ` @${tag}` : "");

/**
 * One line per pick. By date: "🏮 9-11 Nov: Lantern making at Robbeburg @handle" (the pick's own emoji leads, else 🗓️; a range has no weekday).
 * Clicks and A-Z: "🔥 Sint Maarten in Bilderdijkpark @handle (Wed 11 Nov, Kinkerbuurt)" (the day, then the place; no time).
 */
function line(i: CaptionItem, order: CaptionOrder, variant: CaptionVariant): string {
  const title = cleanText(i.title);
  const tag = fromTag(i.tag, variant);
  const bullet = bulletFor(order);
  // Short captions have room for titles only: every character counts, and the newsletter has the rest.
  if (variant === "short") return `${bullet} ${title}`;
  const place = i.place ? cleanText(i.place) : i.group ? cleanText(i.group) : "";
  if (order === "date") {
    // A pick without a date has no day to show, so it gets a plain bullet instead.
    if (!i.date) return `• ${title}${tag}${place ? ` (${place})` : ""}`;
    const { emoji, rest } = splitLeadEmoji(title);
    return `${emoji ?? bullet} ${rangeLabel(i.date, i.endDate)}: ${rest || title}${tag}${place ? ` (${place})` : ""}`;
  }
  // The day only: a time, if any, stays in the newsletter.
  const day = i.date ? rangeLabel(i.date, i.endDate) : i.when ? cleanWhen(i.when).replace(/\s*@.*$/, "") : "";
  const parens = [day, place].filter(Boolean).join(", ");
  return `${bullet} ${title}${tag}${parens ? ` (${parens})` : ""}`;
}

export const isInstagram = (service: string) => service.toLowerCase().replace(/[^a-z]/g, "") === "instagram";

/**
 * The captions: Instagram has no clickable links in captions, so it points to the bio. "Long" is the one for networks with room
 * (LinkedIn, Facebook), with the newsletter URL. "Short" is for X, Bluesky, Threads and Mastodon: a few titles and the link.
 */
export type CaptionVariant = "instagram" | "link" | "short";
export const CAPTION_VARIANTS: { id: CaptionVariant; label: string }[] = [
  { id: "link", label: "Long" },
  { id: "instagram", label: "Instagram" },
  { id: "short", label: "Short" },
];
/** A caption's name where it is shown. With no Short caption beside it, "Long" is the one every text network gets, so it is called "Base". */
export const variantLabel = (id: CaptionVariant, shown: CaptionVariant[]): string =>
  id === "link" && !shown.includes("short") ? "Base" : CAPTION_VARIANTS.find((v) => v.id === id)!.label;
export const variantFor = (service: string): CaptionVariant => (isInstagram(service) ? "instagram" : SHORT_NETWORKS.has(serviceKey(service)) ? "short" : "link");
/** Every network a caption is written for (by name, in a fixed order), whether or not the account has it connected. */
export const networksOf = (variant: CaptionVariant): string[] => [
  ...new Set(Object.keys(CHAR_LIMITS).filter((k) => variantFor(k) === variant).map(serviceLabel)),
];
/** One network's own limit, if known. */
export const limitOf = (service: string): number | undefined => CHAR_LIMITS[serviceKey(service)];
/** How a caption is counted: UTF-16 units, and on Instagram every line break counts as 2 (Buffer's docs, "How Buffer counts characters"). */
export const captionLength = (text: string, variant: CaptionVariant): number =>
  variant === "instagram" ? text.length + (text.match(/\n/g)?.length ?? 0) : text.length;

/** Instagram refuses a caption with more than this many @mentions (Buffer's composer: "At most 20 mentions can be used for caption and comment"). */
export const MAX_MENTIONS: Record<string, number> = { instagram: 20 };
const MENTION = /(^|[^\w.@])@([\w.]{1,30})/g;
/** How many @mentions a text has (an e-mail address isn't one). */
export const mentionCount = (text: string): number => (text.match(MENTION) ?? []).length;
/**
 * Whether `text` fits one network's own rules: its character limit, and on Instagram its @mention limit. A network with no known limit counts
 * as fitting. `over` is how many characters too many and `mentionsOver` how many mentions too many (0 when fine). Links are counted at their
 * real length, which is the safe side where Buffer counts them shorter (LinkedIn 24, X 23).
 */
export function fitFor(service: string, text: string): { limit: number | undefined; over: number; mentionsOver: number; fits: boolean } {
  const limit = limitOf(service);
  const over = limit === undefined ? 0 : Math.max(0, captionLength(text, variantFor(service)) - limit);
  const max = MAX_MENTIONS[serviceKey(service)];
  const mentionsOver = max === undefined ? 0 : Math.max(0, mentionCount(text) - max);
  return { limit, over, mentionsOver, fits: over === 0 && mentionsOver === 0 };
}

/**
 * A short note for a draft that was saved over its network's limit (Buffer allows that for drafts, but won't schedule or publish it): what is
 * over, and what to do. Null when the caption fits.
 */
export function limitNote(service: string, text: string): string | null {
  const f = fitFor(service, text);
  if (f.fits) return null;
  const parts = [
    ...(f.over > 0 ? [`${f.over.toLocaleString("en")} characters over`] : []),
    ...(f.mentionsOver > 0 ? [`${f.mentionsOver} @tags over the limit of ${MAX_MENTIONS[serviceKey(service)]}`] : []),
  ];
  return `Over ${serviceLabel(service)}'s limit (${parts.join(", ")}). Fix it in Buffer before scheduling.`;
}

/** "Send now" to a channel whose caption is over its limit becomes a draft instead (Buffer would refuse to publish it), to shorten in Buffer. Drafts stay drafts. */
export const effectiveIntent = (service: string, text: string, wanted: PostIntent): PostIntent =>
  wanted === "now" && !fitFor(service, text).fits ? "draft" : wanted;

/** The room a variant's caption has: the tightest limit among the networks that use it (`services` = their Buffer services). */
export function variantLimit(variant: CaptionVariant, services: string[]): number {
  const own = services.filter((s) => variantFor(s) === variant).map(limitOf).filter((n): n is number => n !== undefined);
  return own.length > 0 ? Math.min(...own) : DEFAULT_LIMIT[variant];
}

type CaptionOpts = { /** Most characters the caption may have; defaults to the variant's usual limit. */ limit?: number; newsletter: string; /** Content from someone else's public post: every caption links to the original (Instagram too, as text). */ creditLink?: boolean; /** Credited after the newsletter name when the page names one. */ author?: string | null; heading?: string; order: CaptionOrder; variant: CaptionVariant; link: string };

/** The caption, and the titles of the picks that didn't fit in it (in caption order). */
function fitCaption(items: CaptionItem[], opts: CaptionOpts): { text: string; leftOut: string[] } {
  const sorted = sortCaptionItems(items, opts.order);
  // Instagram refuses more @mentions than it allows: the first ones keep their @handle, the rest go without.
  let tagged = 0;
  const maxTags = opts.variant === "instagram" ? MAX_MENTIONS.instagram : Infinity;
  const all = sorted.map((i) => line(i.tag && ++tagged > maxTags ? { ...i, tag: null } : i, opts.order, opts.variant));
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
  // Who to credit for the pictures on the slides (each once), for the picks that made it into the caption. Short captions have no room for it.
  const credits = (n: number) => {
    const seen = new Set<string>();
    return opts.variant === "short"
      ? []
      : sorted
          .slice(0, n)
          .map((i) => (i.photoCredit ? cleanText(i.photoCredit) : ""))
          .filter((c) => c && !seen.has(c.toLowerCase()) && !!seen.add(c.toLowerCase()));
  };
  const build = (n: number) => {
    const more = all.length - n;
    const credited = credits(n);
    return [head, "", list(n) + (more > 0 ? `\n…and ${more} more` : ""), "", ...(credited.length ? [`📷 Photos: ${credited.join(", ")}`, ""] : []), foot].join("\n");
  };
  // Every pick goes in while the caption fits; otherwise as many as fit, then "…and N more". At least one always stays.
  const limit = opts.limit ?? DEFAULT_LIMIT[opts.variant];
  let n = all.length;
  while (n > 1 && captionLength(build(n), opts.variant) > limit) n--;
  return { text: build(n), leftOut: sorted.slice(n).map((i) => cleanText(i.title)) };
}

/** Plain-template caption (no LLM). */
export const buildCaption = (items: CaptionItem[], opts: CaptionOpts): string => fitCaption(items, opts).text;

/** Titles of the picks the template caption has to leave out to stay within its limit. */
export const captionLeftOut = (items: CaptionItem[], opts: CaptionOpts): string[] => fitCaption(items, opts).leftOut;
