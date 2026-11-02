/** Template choices from the Create step. Empty object = the standard template. They travel as URL params. */
export type TemplateOptions = {
  /** Picks per slide; omitted = automatic (fewer picks get more room). */
  perSlide?: 1 | 2 | 3;
  heading?: string;
  closingTitle?: string;
  closingLine?: string;
  cta?: string;
};

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
  };
}

export const parseTemplateFrom = (sp: URLSearchParams) => parseTemplate((k) => sp.get(k));
export const parseTemplateFromPage = (sp: Record<string, string | string[] | undefined>) =>
  parseTemplate((k) => (Array.isArray(sp[k]) ? sp[k][0] : (sp[k] as string | undefined)));

export function templateParams(o: TemplateOptions): URLSearchParams {
  const p = new URLSearchParams();
  if (o.perSlide) p.set("perSlide", String(o.perSlide));
  for (const k of ["heading", "closingTitle", "closingLine", "cta"] as const) if (o[k]) p.set(k, o[k]!);
  return p;
}
