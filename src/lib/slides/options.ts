import { palFromParam } from "../palette";
import { isImageId } from "@/lib/pollen/imageIds";
import { cleanHandle } from "@/lib/pollen/url";
import { PHOTO_MAX_PICKS } from "./types";

/** Template choices from the Design step. Empty object = the standard template. They travel as URL params. */
export type TemplateOptions = {
  /** Picks per slide; omitted = automatic (fewer picks get more room). */
  perSlide?: 1 | 2 | 3;
  heading?: string;
  closingTitle?: string;
  closingLine?: string;
  cta?: string;
  /** A hand-built carousel (Customize): which picks go on which slide, plus text edits. Overrides perSlide. */
  spec?: CustomSpec;
  /** Version (a number) of the signed-in user's slide style from Settings. Only there so a changed style is a new address, never a cached image. */
  sv?: string;
  /** The demo's palette (see palParam in ../palette): signed-in slides use the saved one. */
  pal?: string;
};

/** Text changes a user made to one pick. A key that is present replaces the original (an empty string clears it). */
export type PickEdit = {
  title?: string;
  when?: string;
  place?: string;
  blurb?: string;
  /** Category label shown as a pill on the card (and in the header when a whole slide shares it). An empty string removes it. */
  group?: string;
  /** Card color, e.g. "#f6bd60". */ bg?: string;
  /** A picture from the issue (an IssueImage id) shown on the card. An empty string means none. */
  photo?: string;
  /** Who to credit for that picture ("@handle", a site's name), drawn as a small label on it. Empty = no credit. */
  photoCredit?: string;
  /** Instagram handle (no "@") to tag on this pick, whether or not its link points to Instagram. It replaces the one found in the link; an empty string removes that one. It goes on the slide and, as "From @handle", into the Instagram caption. */
  tag?: string;
};

/** A hand-built carousel. Slides hold chunk ids (1-4 each); the cover and closing slide come from `cover` / `closing`. */
export type CustomSpec = {
  cover?: {
    title?: string;
    subtitle?: string;
    /** Background hex, e.g. "#f6bd60". */ bg?: string;
    /** A picture from the issue (an IssueImage id). */
    photo?: string;
    /** Where the picture goes. Missing = "section". */
    photoMode?: "section" | "background";
    /** "None" was chosen on purpose: no picture, not even the issue's own preview image that the cover uses when nothing is chosen. */
    noPhoto?: boolean;
    /** A faded dandelion in the top right corner. */
    puff?: boolean;
  };
  closing?: {
    title?: string;
    line?: string;
    cta?: string;
    bg?: string;
    /** A picture from the issue (an IssueImage id), a built-in one, or one the user saved. No picture unless one is chosen. */
    photo?: string;
    /** Where the picture goes. Missing = "section". */
    photoMode?: "section" | "background";
  };
  slides: number[][];
  /** Background hex per pick slide, parallel to `slides` ("" or missing = default). */
  bgs?: string[];
  /** Parallel to `slides`: true = this slide leaves out the @handle of picks that link to an Instagram account. Missing = shown. */
  hideTags?: boolean[];
  edits?: Record<number, PickEdit>;
};

/**
 * The picks' edits as the caption should see them: a picture (and so its credit) only counts where it is drawn, which is on a slide with
 * at most PHOTO_MAX_PICKS picks. A pick left on a fuller slide, or on no slide, keeps its other edits but loses photo and credit.
 */
export function pickEditsFor(spec: CustomSpec | undefined): Record<number, PickEdit> | undefined {
  if (!spec?.edits) return undefined;
  const roomy = new Set(spec.slides.filter((g) => g.length <= PHOTO_MAX_PICKS).flat());
  return Object.fromEntries(Object.entries(spec.edits).map(([id, e]) => [id, roomy.has(Number(id)) ? e : { ...e, photo: undefined, photoCredit: undefined }]));
}

export const MAX_PER_SLIDE = 4;
export const MAX_CUSTOM_SLIDES = 18;
export const SPEC_LIMITS = {
  title: 160,
  when: 80,
  place: 60,
  blurb: 700,
  group: 40,
  photoCredit: 60,
  coverTitle: 60,
  coverSubtitle: 400,
  closingTitle: 60,
  closingLine: 100,
  cta: 40,
} as const;

const b64 = (s: string) => {
  let bin = "";
  new TextEncoder().encode(s).forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64 = (s: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
      c.charCodeAt(0),
    ),
  );

/** "#F6BD60" or "f6bd60" -> "f6bd60"; anything else -> undefined. */
const hex6 = (v: unknown) =>
  typeof v === "string" && /^#?[0-9a-f]{6}$/i.test(v.trim())
    ? v.trim().replace("#", "").toLowerCase()
    : undefined;
const withHash = (v: unknown) => {
  const h = hex6(v);
  return h ? `#${h}` : undefined;
};

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.slice(0, max) : undefined;

/** Compact wire form (short keys) so the URL stays small. */
export function encodeSpec(spec: CustomSpec): string {
  const wire = {
    c: spec.cover && {
      t: spec.cover.title,
      s: spec.cover.subtitle,
      g: hex6(spec.cover.bg),
      p: spec.cover.photo || undefined,
      m: spec.cover.photo && spec.cover.photoMode === "background" ? "b" : undefined,
      d: spec.cover.puff ? 1 : undefined,
      n: spec.cover.noPhoto && !spec.cover.photo ? 1 : undefined,
    },
    x: spec.closing && {
      t: spec.closing.title,
      l: spec.closing.line,
      c: spec.closing.cta,
      g: hex6(spec.closing.bg),
      p: spec.closing.photo || undefined,
      m: spec.closing.photo && spec.closing.photoMode === "background" ? "b" : undefined,
    },
    s: spec.slides,
    h: spec.hideTags?.some(Boolean) ? spec.slides.map((_, i) => (spec.hideTags![i] ? 1 : 0)) : undefined,
    g: spec.bgs?.some((b) => b)
      ? spec.slides.map((_, i) => hex6(spec.bgs![i]) ?? "")
      : undefined,
    e:
      spec.edits &&
      Object.fromEntries(
        Object.entries(spec.edits).map(([id, e]) => [
          id,
          { t: e.title, w: e.when, p: e.place, b: e.blurb, c: e.group, g: hex6(e.bg), o: e.photo || undefined, r: e.photo ? e.photoCredit || undefined : undefined, a: e.tag },
        ]),
      ),
  };
  return b64(JSON.stringify(wire));
}

/** The cover slide's title (the hand-built cover's, else the template heading). The caption opens with the same words. */
export const coverTitle = (o: TemplateOptions): string | undefined =>
  o.spec?.cover?.title?.trim() || o.heading;

/** The same object without its undefined keys, so a decoded spec only has the fields it was given. */
const omitUndefined = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** Reads and sanitizes a spec from a URL param; anything malformed is dropped, never thrown. */
export function decodeSpec(
  raw: string | null | undefined,
): CustomSpec | undefined {
  if (!raw) return undefined;
  try {
    const w = JSON.parse(unb64(raw)) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const seen = new Set<number>();
    const slides = (Array.isArray(w.s) ? w.s : [])
      .slice(0, MAX_CUSTOM_SLIDES)
      .map((g: unknown) =>
        (Array.isArray(g) ? g : [])
          .map(Number)
          .filter(
            (id: number) =>
              Number.isInteger(id) && !seen.has(id) && seen.add(id),
          )
          .slice(0, MAX_PER_SLIDE),
      );
    if (slides.length === 0) slides.push([]);
    const edits: Record<number, PickEdit> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const [id, e] of Object.entries((w.e ?? {}) as Record<string, any>)) {
      if (!Number.isInteger(Number(id)) || !e || typeof e !== "object")
        continue;
      const edit: PickEdit = {
        title: str(e.t, SPEC_LIMITS.title),
        when: str(e.w, SPEC_LIMITS.when),
        place: str(e.p, SPEC_LIMITS.place),
        blurb: str(e.b, SPEC_LIMITS.blurb),
        group: str(e.c, SPEC_LIMITS.group),
        bg: withHash(e.g),
        photo: isImageId(e.o) ? e.o : undefined,
        photoCredit: isImageId(e.o) ? str(e.r, SPEC_LIMITS.photoCredit) : undefined,
        // "" is kept on purpose: it removes the tag found in the pick's link. Anything that is not a handle is dropped.
        tag: e.a === "" ? "" : (cleanHandle(e.a) ?? undefined),
      };
      (Object.keys(edit) as (keyof PickEdit)[]).forEach(
        (k) => edit[k] === undefined && delete edit[k],
      );
      if (Object.keys(edit).length) edits[Number(id)] = edit;
    }
    return omitUndefined({
      cover: w.c
        ? omitUndefined({
            title: str(w.c.t, SPEC_LIMITS.coverTitle),
            subtitle: str(w.c.s, SPEC_LIMITS.coverSubtitle),
            bg: withHash(w.c.g),
            // Only an id from the issue is accepted, never an address.
            ...(isImageId(w.c.p) ? { photo: w.c.p, photoMode: w.c.m === "b" ? ("background" as const) : ("section" as const) } : {}),
            ...(w.c.d === 1 ? { puff: true } : {}),
            ...(w.c.n === 1 && !isImageId(w.c.p) ? { noPhoto: true } : {}),
          })
        : undefined,
      closing: w.x
        ? {
            title: str(w.x.t, SPEC_LIMITS.closingTitle),
            line: str(w.x.l, SPEC_LIMITS.closingLine),
            cta: str(w.x.c, SPEC_LIMITS.cta),
            bg: withHash(w.x.g),
            // Only an id from the issue is accepted, never an address.
            ...(isImageId(w.x.p) ? { photo: w.x.p, photoMode: w.x.m === "b" ? ("background" as const) : ("section" as const) } : {}),
          }
        : undefined,
      slides,
      hideTags: Array.isArray(w.h) && w.h.some((x: unknown) => x === 1) ? slides.map((_: unknown, i: number) => w.h[i] === 1) : undefined,
      bgs: Array.isArray(w.g)
        ? slides.map((_: unknown, i: number) => withHash(w.g[i]) ?? "")
        : undefined,
      edits: Object.keys(edits).length ? edits : undefined,
    });
  } catch {
    return undefined;
  }
}

export const TEXT_MAX = {
  heading: 60,
  closingTitle: 60,
  closingLine: 100,
  cta: 40,
} as const;

type Getter = (key: string) => string | null | undefined;

export function parseTemplate(get: Getter): TemplateOptions {
  const text = (k: keyof typeof TEXT_MAX) =>
    get(k)?.trim().slice(0, TEXT_MAX[k]) || undefined;
  const n = Number(get("perSlide"));
  return {
    perSlide: n === 1 || n === 2 || n === 3 ? n : undefined,
    heading: text("heading"),
    closingTitle: text("closingTitle"),
    closingLine: text("closingLine"),
    cta: text("cta"),
    spec: decodeSpec(get("spec")),
    sv: /^\d{1,13}$/.test(get("sv") ?? "") ? get("sv")! : undefined,
    pal: palFromParam(get("pal")) ? get("pal")!.toLowerCase() : undefined,
  };
}

export const parseTemplateFrom = (sp: URLSearchParams) =>
  parseTemplate((k) => sp.get(k));
export const parseTemplateFromPage = (
  sp: Record<string, string | string[] | undefined>,
) =>
  parseTemplate((k) =>
    Array.isArray(sp[k]) ? sp[k][0] : (sp[k] as string | undefined),
  );

export function templateParams(o: TemplateOptions): URLSearchParams {
  const p = new URLSearchParams();
  if (o.perSlide) p.set("perSlide", String(o.perSlide));
  for (const k of ["heading", "closingTitle", "closingLine", "cta"] as const)
    if (o[k]) p.set(k, o[k]!);
  if (o.spec) p.set("spec", encodeSpec(o.spec));
  if (o.sv) p.set("sv", o.sv);
  if (o.pal) p.set("pal", o.pal);
  return p;
}
