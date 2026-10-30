import { HTMLElement, parse } from "node-html-parser";
import { normalizeUrl } from "./url";

const clean = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();

export type Chunk = {
  id: number;
  /** Heading (h1/h2/h3) the chunk sits under. */
  section: string;
  /** Short label paragraph above a list ("Good for babies"), if any. */
  group?: string;
  kind: "bullet" | "paragraph";
  /** Display title: first link text, else the first words. */
  title: string;
  /** Remaining text (date line, blurb). */
  body: string;
  /** Full plain text of the chunk. */
  text: string;
  /** Italic date line of a bullet ("Mon 26 Oct @ 9:30-12:30 — De Pijp"), split at the em dash. */
  when: string | null;
  place: string | null;
  /** Text left after removing the title and the date line. */
  blurb: string;
  url: string | null;
  key: string | null;
};

/**
 * Splits an issue into selectable chunks: every paragraph and every list item, with the heading and
 * (for lists) the group label above it. Layout-agnostic: it only relies on headings, <p>, <ul>, <ol>.
 */
export function parseChunks(html: string): Chunk[] {
  const nodes = parse(html.replace(/<br\s*\/?>|<\/(p|em|strong|a)>/gi, (m) => (m.startsWith("</") ? m + " " : " "))).childNodes.filter((n): n is HTMLElement => n instanceof HTMLElement);
  const out: Chunk[] = [];
  let section = "Intro";
  let group: string | undefined;
  const push = (el: HTMLElement, kind: Chunk["kind"], grp?: string) => {
    const text = clean(el.text);
    if (text.length < 15) return;
    const a = el.querySelector("a");
    const url = a?.getAttribute("href") ?? null;
    const anchorText = a ? clean(a.text) : "";
    const title = (anchorText.length >= 4 ? anchorText : text).replace(/\s*[\u{1F300}-\u{1FAFF}]\s*$/u, "").slice(0, 90);
    const body = anchorText && text.startsWith(anchorText) ? clean(text.slice(anchorText.length)) : anchorText ? text : "";
    const em = kind === "bullet" ? el.querySelector("em") : null;
    const dateLine = em ? clean(em.text) : null;
    const parts = dateLine ? dateLine.split(/\s+[—–-]\s+/) : [];
    const when = dateLine ? (parts.length > 1 ? parts.slice(0, -1).join(" — ") : dateLine) : null;
    const place = parts.length > 1 ? parts[parts.length - 1] : null;
    let rest = anchorText && text.startsWith(anchorText) ? text.slice(anchorText.length) : text;
    if (dateLine) rest = rest.replace(dateLine, "");
    out.push({ id: out.length, section, group: grp, kind, title, body, text, when, place, blurb: clean(rest), url, key: url ? normalizeUrl(url) : null });
  };
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const tag = n.tagName.toLowerCase();
    if (/^h[1-3]$/.test(tag)) {
      section = clean(n.text);
      group = undefined;
    } else if (tag === "p") {
      const text = clean(n.text);
      const next = nodes[i + 1]?.tagName?.toLowerCase();
      if ((next === "ul" || next === "ol") && text.length > 0 && text.length < 60 && !n.querySelector("a")) group = text;
      else push(n, "paragraph");
    } else if (tag === "ul" || tag === "ol") {
      for (const li of n.childNodes) if (li instanceof HTMLElement && li.tagName.toLowerCase() === "li") push(li, "bullet", group);
      group = undefined;
    }
  }
  return out;
}
