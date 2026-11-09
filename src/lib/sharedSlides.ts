// "OK to share?" on the feedback form: a tester who says yes lets Alex see what they made, as two links: the issue they started from (the source) and
// the Design step with their picks and layout (the slide link, the same one the Design step's share button copies). Nothing else is stored: no
// slide text, no images. A demo link carries the visitor's highlights with it (hl=), so it opens the same slides. A link from the logged-in app only
// opens for that account. Helpers for the form (browser) and the feedback route (server).

import { stepUrl } from "./flow";
import { DEMO_HL_PARAM, readDemoValue } from "./pollen/demoHighlights";
import { readDemoSource } from "./pollen/demoSource";
import { loadPicked, loadScope, loadTemplate } from "./progress";
import { templateParams } from "./slides/options";

export type ShareLinks = { sourceUrl: string | null; slideUrl: string };

const MAX_URL = 4000;

/** Browser side: the links this tab could share, or null when there is no run to share yet (no picks). */
export function shareLinksOffer(): ShareLinks | null {
  const scope = loadScope();
  if (!scope) return null;
  const mode = scope.split("|")[0];
  const picks = loadPicked(scope);
  if (!picks || picks.length === 0) return null;
  const t = loadTemplate();
  const tpl = t?.custom && t.spec && t.scope === scope ? templateParams({ spec: t.spec }).toString() : "";
  const url = new URL(stepUrl(mode, "design", `picks=${picks.join(",")}${tpl ? `&${tpl}` : ""}`), window.location.origin);
  if (mode === "demo") {
    // Same as the share button: the highlights live in a cookie the person opening the link doesn't have.
    const hl = readDemoValue();
    if (hl) url.searchParams.set(DEMO_HL_PARAM, hl);
    return { sourceUrl: readDemoSource()?.url ?? null, slideUrl: url.toString() };
  }
  // Own issues: the scope is "<mode>|<the issue's public address>".
  const source = scope.includes("|") ? scope.slice(scope.indexOf("|") + 1) : "";
  return { sourceUrl: source || null, slideUrl: url.toString() };
}

const web = (v: unknown): URL | null => {
  if (typeof v !== "string" || v.length > MAX_URL) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
};

/**
 * Server side: checks what the browser sent. The slide link must be a Design step address on this site (a link to anywhere else is not kept); the source
 * is any web address. Returns what to store, or null when there is no valid slide link.
 */
export function cleanShareLinks(v: unknown, siteHosts: string[]): { source_url: string | null; slide_url: string } | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const s = v as Record<string, unknown>;
  const slide = web(s.slideUrl);
  if (!slide || !siteHosts.includes(slide.host) || !/^\/(demo\/)?design\/?$/.test(slide.pathname)) return null;
  const source = web(s.sourceUrl);
  return { source_url: source ? source.toString() : null, slide_url: slide.toString() };
}
