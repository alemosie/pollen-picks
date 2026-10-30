import { HTMLElement, parse } from "node-html-parser";
import { parseWhen } from "./dates";
import { normalizeUrl } from "./url";
import type { Activity } from "./types";

const clean = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();

export type SectionOptions = {
  /** Case-insensitive text the section heading (h1/h2/h3) must contain. Default matches "happening", "events", "activities". */
  heading?: RegExp;
  /** YYYY-MM-DD publish date of the issue, used to infer the year of "26 Oct". */
  reference: string;
};

export function listHeadings(html: string): string[] {
  return parse(html).querySelectorAll("h1, h2, h3").map((h) => clean(h.text));
}

/**
 * Finds the activities section and extracts every list item as an Activity.
 * Layout assumed (Beehiiv editor HTML): heading, then optional group labels (a short, link-less paragraph)
 * each followed by a <ul>; each <li> has the title (usually a link) in its first paragraph, an italic date line,
 * and the blurb.
 */
export function parseActivities(html: string, opts: SectionOptions): Activity[] {
  const root = parse(html);
  const heading = opts.heading ?? /happening|events|activities/i;
  const nodes = root.childNodes.filter((n): n is HTMLElement => n instanceof HTMLElement);
  const start = nodes.findIndex((n) => /^h[1-3]$/i.test(n.tagName) && heading.test(clean(n.text)));
  if (start < 0) return [];

  const out: Activity[] = [];
  let group: string | undefined;
  for (let i = start + 1; i < nodes.length; i++) {
    const n = nodes[i];
    const tag = n.tagName.toLowerCase();
    if (tag === "h1" || tag === "h2") break; // next section
    if (tag === "p") {
      const text = clean(n.text);
      const next = nodes[i + 1]?.tagName?.toLowerCase();
      group = next === "ul" && text.length > 0 && text.length < 60 && !n.querySelector("a") ? text : group;
      continue;
    }
    if (tag !== "ul") continue;
    for (const li of n.childNodes.filter((c): c is HTMLElement => c instanceof HTMLElement && c.tagName.toLowerCase() === "li")) {
      out.push(parseItem(li, out.length, group, opts.reference));
    }
  }
  return out;
}

function parseItem(li: HTMLElement, id: number, group: string | undefined, reference: string): Activity {
  const ps = li.childNodes.filter((c): c is HTMLElement => c instanceof HTMLElement && c.tagName.toLowerCase() === "p");
  const first = ps[0];
  const anchors = first?.querySelectorAll("a") ?? [];
  const title = clean(anchors[0]?.text ?? first?.text ?? "").replace(/\s*[\u{1F300}-\u{1FAFF}]\s*$/u, "");
  const url = anchors[0]?.getAttribute("href") ?? null;

  // Date line: the first <em> in the bullet (it may share the title paragraph, after a <br>).
  const em = li.querySelector("em");
  const dateLine = em ? clean(em.text) : null;
  const [when, place] = dateLine ? splitDateLine(dateLine) : [null, null];

  const blurbPs = ps.filter((p) => p !== first && !(em && p.querySelector("em") === em && clean(p.text) === dateLine));
  const blurbAnchors = blurbPs.flatMap((p) => p.querySelectorAll("a"));
  return {
    id,
    title: title || clean(li.text).slice(0, 60),
    group,
    url,
    key: url ? normalizeUrl(url) : null,
    hostLinks: anchors.slice(1).map((a) => a.getAttribute("href") ?? "").filter(Boolean),
    blurbLinks: blurbAnchors.map((a) => a.getAttribute("href") ?? "").filter(Boolean),
    dateLine,
    when,
    place,
    parsed: when ? parseWhen(when, reference) : null,
    blurb: clean(blurbPs.map((p) => p.text).join(" ")),
  };
}

function splitDateLine(line: string): [string, string | null] {
  const m = line.split(/\s+[—–-]\s+/); // " — " (also en dash / spaced hyphen)
  if (m.length < 2) return [line, null];
  return [m.slice(0, -1).join(" — "), m[m.length - 1]];
}
