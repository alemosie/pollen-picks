import { HTMLElement, parse } from "node-html-parser";
import { normalizeUrl } from "./url";

const clean = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();

export type Chunk = {
  id: number;
  /** Heading (h1/h2/h3) the chunk sits under. */
  section: string;
  /** Short label paragraph above a list ("Good for babies"), if any. */
  group?: string;
  /**
   * The bold label the chunk sits under: a bold area label above a list ("West"), or one that introduces a stretch with its
   * own content ("Sint Maarten", then a lead-in paragraph and underlined sub-labels). Shown as a pill, until the next bold
   * label or heading. `group` stays the nearest label above the list, whatever its styling.
   */
  topic?: string;
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

const lettersOnly = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, "");

/** Is the whole paragraph set in the given tags (emoji and punctuation aside)? A bold word inside a sentence is not. */
function wholly(el: HTMLElement, selector: string): boolean {
  const styled = lettersOnly(
    el
      .querySelectorAll(selector)
      .map((e) => e.text)
      .join(""),
  );
  return styled.length > 0 && styled === lettersOnly(el.text);
}

/**
 * Splits an issue into selectable chunks: every paragraph and every list item, with the heading and
 * (for lists) the group label above it. Layout-agnostic: it relies on headings, <p>, <ul>, <ol>, and on bold only for
 * a short, link-less, wholly bold paragraph that is not itself directly above a list but has a list somewhere below it
 * (a topic); a bold line anywhere else stays an ordinary paragraph.
 */
export function parseChunks(html: string): Chunk[] {
  const nodes = parse(
    html.replace(/<br\s*\/?>|<\/(p|em|strong|a)>/gi, (m) =>
      m.startsWith("</") ? m + " " : " ",
    ),
  ).childNodes.filter((n): n is HTMLElement => n instanceof HTMLElement);
  const out: Chunk[] = [];
  let section = "Intro";
  let group: string | undefined;
  let topic: string | undefined;
  const listBelow = (from: number) => {
    for (let j = from + 1; j < nodes.length; j++) {
      const t = nodes[j].tagName.toLowerCase();
      if (/^h[1-3]$/.test(t)) return false;
      if (t === "ul" || t === "ol") return true;
    }
    return false;
  };
  const push = (el: HTMLElement, kind: Chunk["kind"], grp?: string) => {
    const text = clean(el.text);
    if (text.length < 15) return;
    const a = el.querySelector("a");
    const url = a?.getAttribute("href") ?? null;
    const anchorText = a ? clean(a.text) : "";
    // The title is the link text; a bullet without a link ("**Local Trick or Treating**") uses its bold text, else its first paragraph.
    const boldText =
      kind === "bullet" ? clean(el.querySelector("strong")?.text ?? "") : "";
    const firstPara =
      kind === "bullet" ? clean(el.querySelector("p")?.text ?? "") : "";
    const lead =
      [anchorText, boldText, firstPara].find(
        (t) => t.length >= 4 && t.length < text.length,
      ) ?? "";
    const title = (lead || text)
      .replace(/\s*[\u{1F300}-\u{1FAFF}]\s*$/u, "")
      .slice(0, 90);
    const body =
      lead && text.startsWith(lead)
        ? clean(text.slice(lead.length))
        : lead
          ? text
          : "";
    const em = kind === "bullet" ? el.querySelector("em") : null;
    const dateLine = em ? clean(em.text) : null;
    const parts = dateLine ? dateLine.split(/\s+[—–-]\s+/) : [];
    const when = dateLine
      ? parts.length > 1
        ? parts.slice(0, -1).join(" — ")
        : dateLine
      : null;
    const place = parts.length > 1 ? parts[parts.length - 1] : null;
    let rest = lead && text.startsWith(lead) ? text.slice(lead.length) : text;
    if (dateLine) rest = rest.replace(dateLine, "");
    out.push({
      id: out.length,
      section,
      group: grp,
      topic,
      kind,
      title,
      body,
      text,
      when,
      place,
      blurb: clean(rest),
      url,
      key: url ? normalizeUrl(url) : null,
    });
  };
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const tag = n.tagName.toLowerCase();
    if (/^h[1-3]$/.test(tag)) {
      section = clean(n.text);
      group = undefined;
      topic = undefined;
    } else if (tag === "p") {
      const text = clean(n.text);
      const next = nodes[i + 1]?.tagName?.toLowerCase();
      const isLabel =
        text.length > 0 && text.length < 60 && !n.querySelector("a");
      if (isLabel && (next === "ul" || next === "ol")) {
        group = text;
        // A bold label ("APP & Friends", "South") is itself a topic: it replaces the previous one, and the group is the same text.
        // An underlined or plain label is a subheader that stays inside the current topic.
        if (wholly(n, "strong, b")) topic = text;
      } else if (isLabel && wholly(n, "strong, b") && listBelow(i)) {
        topic = text;
        group = undefined;
      } else push(n, "paragraph");
    } else if (tag === "ul" || tag === "ol") {
      for (const li of n.childNodes)
        if (li instanceof HTMLElement && li.tagName.toLowerCase() === "li")
          push(li, "bullet", group);
      group = undefined;
    }
  }
  return out;
}
