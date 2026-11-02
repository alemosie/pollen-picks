/** Template choices from the Create step. Empty object = the standard template. They travel as URL params. */
export type TemplateOptions = {
  /** Picks per slide; omitted = automatic (fewer picks get more room). */
  perSlide?: 1 | 2 | 3;
  heading?: string;
  closingTitle?: string;
  closingLine?: string;
  cta?: string;
  /** A hand-built carousel (Customize): which picks go on which slide, plus text edits. Overrides perSlide. */
  spec?: CustomSpec;
};

/** Text changes a user made to one pick. A key that is present replaces the original (an empty string clears it). */
export type PickEdit = { title?: string; when?: string; place?: string; blurb?: string };

/** A hand-built carousel. Slides hold chunk ids (1-4 each); the cover and closing slide come from `cover` / `closing`. */
export type CustomSpec = {
  cover?: { title?: string; subtitle?: string };
  closing?: { title?: string; line?: string; cta?: string };
  slides: number[][];
  edits?: Record<number, PickEdit>;
};

export const MAX_PER_SLIDE = 4;
export const MAX_CUSTOM_SLIDES = 18;
export const SPEC_LIMITS = { title: 90, when: 80, place: 60, blurb: 400, coverTitle: 60, coverSubtitle: 80, closingTitle: 60, closingLine: 100, cta: 40 } as const;

const b64 = (s: string) => {
  let bin = "";
  new TextEncoder().encode(s).forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

/** Compact wire form (short keys) so the URL stays small. */
export function encodeSpec(spec: CustomSpec): string {
  const wire = {
    c: spec.cover && { t: spec.cover.title, s: spec.cover.subtitle },
    x: spec.closing && { t: spec.closing.title, l: spec.closing.line, c: spec.closing.cta },
    s: spec.slides,
    e: spec.edits && Object.fromEntries(Object.entries(spec.edits).map(([id, e]) => [id, { t: e.title, w: e.when, p: e.place, b: e.blurb }])),
  };
  return b64(JSON.stringify(wire));
}

/** Reads and sanitizes a spec from a URL param; anything malformed is dropped, never thrown. */
export function decodeSpec(raw: string | null | undefined): CustomSpec | undefined {
  if (!raw) return undefined;
  try {
    const w = JSON.parse(unb64(raw)) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const seen = new Set<number>();
    const slides = (Array.isArray(w.s) ? w.s : [])
      .slice(0, MAX_CUSTOM_SLIDES)
      .map((g: unknown) =>
        (Array.isArray(g) ? g : [])
          .map(Number)
          .filter((id: number) => Number.isInteger(id) && !seen.has(id) && seen.add(id))
          .slice(0, MAX_PER_SLIDE),
      );
    if (slides.length === 0) slides.push([]);
    const edits: Record<number, PickEdit> = {};
    for (const [id, e] of Object.entries((w.e ?? {}) as Record<string, any>)) { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!Number.isInteger(Number(id)) || !e || typeof e !== "object") continue;
      const edit: PickEdit = { title: str(e.t, SPEC_LIMITS.title), when: str(e.w, SPEC_LIMITS.when), place: str(e.p, SPEC_LIMITS.place), blurb: str(e.b, SPEC_LIMITS.blurb) };
      (Object.keys(edit) as (keyof PickEdit)[]).forEach((k) => edit[k] === undefined && delete edit[k]);
      if (Object.keys(edit).length) edits[Number(id)] = edit;
    }
    return {
      cover: w.c ? { title: str(w.c.t, SPEC_LIMITS.coverTitle), subtitle: str(w.c.s, SPEC_LIMITS.coverSubtitle) } : undefined,
      closing: w.x ? { title: str(w.x.t, SPEC_LIMITS.closingTitle), line: str(w.x.l, SPEC_LIMITS.closingLine), cta: str(w.x.c, SPEC_LIMITS.cta) } : undefined,
      slides,
      edits: Object.keys(edits).length ? edits : undefined,
    };
  } catch {
    return undefined;
  }
}

export const TEXT_MAX = { heading: 60, closingTitle: 60, closingLine: 100, cta: 40 } as const;

type Getter = (key: string) => string | null | undefined;

export function parseTemplate(get: Getter): TemplateOptions {
  const text = (k: keyof typeof TEXT_MAX) => get(k)?.trim().slice(0, TEXT_MAX[k]) || undefined;
  const n = Number(get("perSlide"));
  return {
    perSlide: n === 1 || n === 2 || n === 3 ? n : undefined,
    heading: text("heading"),
    closingTitle: text("closingTitle"),
    closingLine: text("closingLine"),
    cta: text("cta"),
    spec: decodeSpec(get("spec")),
  };
}

export const parseTemplateFrom = (sp: URLSearchParams) => parseTemplate((k) => sp.get(k));
export const parseTemplateFromPage = (sp: Record<string, string | string[] | undefined>) =>
  parseTemplate((k) => (Array.isArray(sp[k]) ? sp[k][0] : (sp[k] as string | undefined)));

export function templateParams(o: TemplateOptions): URLSearchParams {
  const p = new URLSearchParams();
  if (o.perSlide) p.set("perSlide", String(o.perSlide));
  for (const k of ["heading", "closingTitle", "closingLine", "cta"] as const) if (o[k]) p.set(k, o[k]!);
  if (o.spec) p.set("spec", encodeSpec(o.spec));
  return p;
}
