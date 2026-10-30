import { MAX_IMAGES, type Slide, type SlideItem } from "./types";

// Emoji need a network fetch inside Satori, and read as noise on slides.
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

export type PlanOptions = {
  newsletter: string;
  /** Cover headline. */
  heading?: string;
  /** Items in the source section that were not picked, shown as "+N more" on the closing slide. */
  moreInNewsletter?: number;
};

/** cover + pick slides + closing, never more than MAX_IMAGES. */
export function planSlides(raw: SlideItem[], opts: PlanOptions): Slide[] {
  const items = raw.map((i) => ({
    ...i,
    title: stripEmoji(i.title),
    group: i.group ? stripEmoji(i.group) : undefined,
    when: i.when ? stripEmoji(i.when) : null,
    place: i.place ? stripEmoji(i.place) : null,
    blurb: i.blurb ? stripEmoji(i.blurb) : undefined,
  }));
  let k: number = picksPerSlide(items.length);
  let groups = packGroups(items, k);
  while (groups.length > MAX_IMAGES - 2 && k < 3) {
    k++;
    groups = packGroups(items, k);
  }
  groups = groups.slice(0, MAX_IMAGES - 2);
  const shown = groups.reduce((n, g) => n + g.length, 0);
  const slides: Slide[] = [
    { kind: "cover", title: opts.heading ?? "This week's picks", subtitle: `${items.length} ${items.length === 1 ? "pick" : "picks"} from ${opts.newsletter}` },
    ...groups.map((g, i): Slide => ({
      kind: "picks",
      items: g,
      group: g.every((x) => x.group === g[0].group) ? g[0].group : undefined,
      page: i + 1,
      pages: groups.length,
    })),
    { kind: "closing", title: "Want the full list?", line: `Read every pick in ${opts.newsletter}`, more: (opts.moreInNewsletter ?? 0) + (items.length - shown) },
  ];
  return slides;
}
