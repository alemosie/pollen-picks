import type { CustomSpec } from "./options";
import { MAX_IMAGES, type Slide, type SlideItem } from "./types";

// Emoji are kept by default. Satori fetches their images at render time, so the renderer falls back to stripEmoji if that fails.
export const stripEmoji = (s: string) =>
  s
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/** Picks per slide: fewer picks get more room, long lists get compact cards. */
export function picksPerSlide(n: number): 1 | 2 | 3 {
  return n <= 4 ? 1 : n <= 10 ? 2 : 3;
}

/**
 * Packs picks into slides of `k`, keeping each sub-header group together when it fits
 * ("Good for babies" stays on one slide) and splitting a group only when it is longer than a slide.
 */
export function packGroups(items: SlideItem[], k: number): SlideItem[][] {
  const runs: SlideItem[][] = [];
  for (const it of items) {
    const last = runs[runs.length - 1];
    if (last && last[0].group === it.group) last.push(it);
    else runs.push([it]);
  }
  const slides: SlideItem[][] = [];
  let cur: SlideItem[] = [];
  const flush = () => {
    if (cur.length) slides.push(cur);
    cur = [];
  };
  for (const run of runs) {
    if (run.length > k) {
      flush();
      // Split evenly (4 with k=3 -> 2+2), not 3+1.
      const parts = Math.ceil(run.length / k);
      let at = 0;
      for (let p = 0; p < parts; p++) {
        const size = Math.ceil((run.length - at) / (parts - p));
        slides.push(run.slice(at, at + size));
        at += size;
      }
    } else {
      if (cur.length + run.length > k) flush();
      cur.push(...run);
    }
  }
  flush();
  return slides;
}

// Rough layout model, mirroring Slide.tsx: 1080x1350, 72px page padding, 64px header + footer, 28px gaps. A slide's card size depends on how many picks share it.
export const CONTENT_W = 1080 - 2 * 72;
export const BODY_H = 1350 - 2 * 72 - 64 - 64 - 2 * 28;
export const CARD_GAP = 28;
const Z = {
  2: { pad: 44, title: 64, titleLines: 3, meta: 36, blurb: 30, blurbLines: 4, gap: 18 },
  3: { pad: 36, title: 50, titleLines: 2, meta: 30, blurb: 26, blurbLines: 1, gap: 12 },
} as const;
/** The @handle line on a card is this much smaller than the card's date line. */
export const TAG_SHRINK = 6;
/** With 3 or 4 picks on a slide each description is cut at this many characters (then "…"). */
export const SHORT_BLURB = 75;
export const oneLineLimit = (picksOnSlide: number) => (picksOnSlide >= 3 ? SHORT_BLURB : Infinity);
export const shortBlurb = (text: string) => (text.length > SHORT_BLURB ? `${text.slice(0, SHORT_BLURB - 1).trimEnd()}…` : text);
/** A description this many lines over its clamp counts as "too long" and earns a slide of its own. */
const BLURB_EXTRA_LINES = 2;
export const lines = (text: string, px: number, em: number, width: number) => Math.max(1, Math.ceil((text.length * px * em) / width));

/** Would this pick sit comfortably on a slide shared by `n` picks? (n = 1 always fits: it has the whole slide.) */
export function fits(item: SlideItem, n: number): boolean {
  if (n <= 1) return true;
  const z = Z[Math.min(n, 3) as 2 | 3];
  const width = CONTENT_W - 2 * z.pad;
  const titleLines = lines(item.title, z.title, 0.6, width);
  if (titleLines > (n === 2 ? 2 : z.titleLines)) return false; // title would be cut or crowd the card
  if (z.blurbLines > 0 && item.blurb && lines(item.blurb, z.blurb, 0.52, width) > z.blurbLines + BLURB_EXTRA_LINES) return false;
  let h = 2 * z.pad + titleLines * z.title * 1.08;
  if (item.tag) h += z.gap + (z.meta - TAG_SHRINK) * 1.25; // the @handle line (see Slide.tsx)
  const meta = [item.when, item.place].filter(Boolean).join(" · ");
  if (meta) h += z.gap + Math.min(2, lines(meta, z.meta, 0.55, width)) * z.meta * 1.25;
  if (z.blurbLines > 0 && item.blurb) h += z.gap + Math.min(z.blurbLines, lines(item.blurb, z.blurb, 0.52, width)) * z.blurb * 1.35;
  return h <= (BODY_H - (n - 1) * CARD_GAP) / n;
}

/**
 * Automatic packing: pack as usual, then any pick that doesn't fit the slide it landed on (title or description too long
 * for a shared card) is pulled out onto a slide of its own. What's left of that slide is re-checked at its new size.
 */
function packAuto(items: SlideItem[]): SlideItem[][] {
  const split = (group: SlideItem[]): SlideItem[][] => {
    if (group.length < 2) return [group];
    const bad = group.filter((it) => !fits(it, group.length));
    if (bad.length === 0) return [group];
    const out: SlideItem[][] = [];
    let rest: SlideItem[] = [];
    const flush = () => {
      if (rest.length) out.push(...split(rest));
      rest = [];
    };
    for (const it of group) {
      if (bad.includes(it)) {
        flush();
        out.push([it]);
      } else rest.push(it);
    }
    flush();
    return out;
  };
  return packGroups(items, picksPerSlide(items.length)).flatMap(split);
}

export type PlanOptions = {
  newsletter: string;
  /** Cover headline. */
  heading?: string;
  /** Picks per slide; omitted = automatic. */
  perSlide?: 1 | 2 | 3;
  closingTitle?: string;
  closingLine?: string;
  /** Closing slide button text. */
  cta?: string;
  /** Items in the source section that were not picked, shown as "+N more" on the closing slide. */
  moreInNewsletter?: number;
  /** A hand-built carousel; when set, picks per slide and packing come from it. */
  spec?: CustomSpec;
  /** The id of the issue's own preview image: the cover's background when the design doesn't choose a picture (or "None") for it. */
  defaultCoverPhoto?: string;
  /** Keep each pick's Instagram tag on its card. On unless false: then the tags are dropped here, before packing. (A hand-built slide can also hide its own, see CustomSpec.hideTags.) */
  showTags?: boolean;
};

/** Slides exactly as the user laid them out: picks (with their text edits) on the slides they chose, cover and closing from the spec. */
export function planCustom(items: SlideItem[], spec: CustomSpec, opts: PlanOptions): Slide[] {
  const byId = new Map(items.filter((i) => i.id != null).map((i) => [i.id!, i]));
  const edited = (id: number): SlideItem | null => {
    const base = byId.get(id);
    if (!base) return null;
    const e = spec.edits?.[id];
    if (!e) return base;
    return {
      ...base,
      title: e.title !== undefined ? e.title.trim() : base.title, // emptied on purpose = no title
      when: e.when !== undefined ? e.when.trim() || null : base.when,
      place: e.place !== undefined ? e.place.trim() || null : base.place,
      blurb: e.blurb !== undefined ? e.blurb.trim() || undefined : base.blurb,
      group: e.group !== undefined ? e.group.trim() || undefined : base.group,
      tag: e.tag !== undefined ? e.tag || undefined : base.tag, // set by hand, or removed on purpose ("")
      bg: e.bg || undefined,
      photoId: e.photo || undefined,
    };
  };
  const placedSlides = spec.slides
    .map((ids, i) => ({
      g: ids.map(edited).filter((x): x is SlideItem => !!x).map((x) => (spec.hideTags?.[i] ? { ...x, tag: undefined } : x)).slice(0, 4),
      bg: spec.bgs?.[i] || undefined,
    }))
    .filter((x) => x.g.length > 0)
    .slice(0, MAX_IMAGES - 2);
  const groups = placedSlides.map((x) => x.g);
  const count = groups.reduce((n, g) => n + g.length, 0);
  const carouselTitle = spec.cover?.title !== undefined ? spec.cover.title.trim() : opts.heading || "This week's picks";
  return [
    // A field the user emptied on purpose stays empty (the slide is laid out without it); one never touched keeps its default.
    {
      kind: "cover",
      bg: spec.cover?.bg,
      title: carouselTitle,
      subtitle: spec.cover?.subtitle !== undefined ? spec.cover.subtitle.trim() : `${count} ${count === 1 ? "pick" : "picks"} from ${opts.newsletter}`,
      ...(spec.cover?.photo
        ? { photoId: spec.cover.photo, photoMode: spec.cover.photoMode ?? "section" }
        : opts.defaultCoverPhoto && !spec.cover?.noPhoto
          ? { photoId: opts.defaultCoverPhoto, photoMode: "background" as const }
          : {}),
      ...(spec.cover?.puff ? { puff: true } : {}),
    },
    ...groups.map((g, i): Slide => ({
      kind: "picks",
      bg: placedSlides[i].bg,
      items: g,
      group: g.every((x) => x.group === g[0].group) ? g[0].group : undefined,
      page: i + 1,
      pages: groups.length,
      carouselTitle,
    })),
    {
      kind: "closing",
      bg: spec.closing?.bg,
      title: spec.closing?.title !== undefined ? spec.closing.title.trim() : opts.closingTitle || "Want the full list?",
      line: spec.closing?.line !== undefined ? spec.closing.line.trim() : opts.closingLine || `Read every pick in ${opts.newsletter}`,
      cta: spec.closing?.cta !== undefined ? spec.closing.cta.trim() : opts.cta, // "" = no button
      more: opts.moreInNewsletter ?? 0,
    },
  ];
}

/** cover + pick slides + closing, never more than MAX_IMAGES. */
export function planSlides(raw: SlideItem[], opts: PlanOptions): Slide[] {
  const tidy = (s: string) => s.replace(/\s+/g, " ").trim();
  const items = raw.map((i) => ({
    ...i,
    title: tidy(i.title),
    group: i.group ? tidy(i.group) : undefined,
    when: i.when ? tidy(i.when) : null,
    place: i.place ? tidy(i.place) : null,
    blurb: i.blurb ? tidy(i.blurb) : undefined,
    tag: opts.showTags === false ? undefined : i.tag,
  }));
  if (opts.spec) return planCustom(items, opts.spec, opts);
  let k: number = opts.perSlide ?? picksPerSlide(items.length);
  // Automatic mode lets long picks take their own slide; if that would need too many slides, fall back to plain packing.
  let groups = opts.perSlide ? packGroups(items, k) : packAuto(items);
  if (groups.length > MAX_IMAGES - 2) groups = packGroups(items, k);
  while (groups.length > MAX_IMAGES - 2 && k < 3) {
    k++;
    groups = packGroups(items, k);
  }
  groups = groups.slice(0, MAX_IMAGES - 2);
  const shown = groups.reduce((n, g) => n + g.length, 0);
  const slides: Slide[] = [
    {
      kind: "cover",
      title: opts.heading ?? "This week's picks",
      subtitle: `${items.length} ${items.length === 1 ? "pick" : "picks"} from ${opts.newsletter}`,
      ...(opts.defaultCoverPhoto ? { photoId: opts.defaultCoverPhoto, photoMode: "background" as const } : {}),
    },
    ...groups.map((g, i): Slide => ({
      kind: "picks",
      items: g,
      group: g.every((x) => x.group === g[0].group) ? g[0].group : undefined,
      page: i + 1,
      pages: groups.length,
      carouselTitle: opts.heading ?? "This week's picks",
    })),
    { kind: "closing", title: opts.closingTitle ?? "Want the full list?", line: opts.closingLine ?? `Read every pick in ${opts.newsletter}`, cta: opts.cta, more: (opts.moreInNewsletter ?? 0) + (items.length - shown) },
  ];
  return slides;
}
