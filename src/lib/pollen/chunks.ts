import { HTMLElement, parse } from "node-html-parser";
import { normalizeUrl } from "./url";

// Text from separate inline elements is joined with a space, so no space is left before closing punctuation ("25% off .").
const clean = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").replace(/ ([.,;:!?])/g, "$1").trim();

/** Separators left at the start of a description where the title and date line were cut out ("— ", ": ", "· "). Opening quotes and brackets stay. */
/** First letter upper case ("the museum's wells" -> "The museum's wells"); a leading digit, emoji or quote is left alone. */
const capitalize = (s: string) => s.replace(/^\p{Ll}/u, (c) => c.toUpperCase());
const LEAD_PUNCT = /^[\s\p{Pd}\p{Pe}\p{Pf}:;,.·•|/\\*~]+/u;

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

const WEEKDAY_HEADING = /^[^\p{L}\p{N}]*((?:mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?|sun)(?:day)?\b.*)$/iu;
const HAS_DAY = /\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|\b\d{1,2}(?:st|nd|rd|th)?\s+[a-z]{3}|\b[a-z]{3,9}\.?\s+\d{1,2}\b|\d{1,2}[/.-]\d{1,2}/i;
const CLOCK_EMOJI = /^[\u{1F550}-\u{1F567}⏰⌚]/u;
const stripLeadEmoji = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, "").trim();

/** A line of fields joined by bars, each with its own emoji ("📍 Venue | 🕖 Fri 7:30pm | 💲 Free"): the venue and the time are read from it. */
function readDetails(line: string): { place: string | null; when: string | null } | null {
  const fields = line.split("|").map((f) => f.trim());
  if (fields.length < 2 || !fields.some((f) => /^(?:\u{1F4CD}|\u{1F4C5}|\u{1F4C6}|\u{1F5D3})/u.test(f) || CLOCK_EMOJI.test(f))) return null;
  const place = fields.find((f) => f.startsWith("\u{1F4CD}"));
  const day = fields.find((f) => /^[\u{1F4C5}\u{1F4C6}\u{1F5D3}]/u.test(f));
  const time = fields.find((f) => CLOCK_EMOJI.test(f));
  const when = [day, time].filter(Boolean).map((f) => stripLeadEmoji(f!)).join(" ") || null;
  return { place: place ? stripLeadEmoji(place) : null, when };
}

/** A paragraph that is just a link (an emoji before it is fine): the title of an entry whose description follows in the next paragraphs. */
function titleOnlyLink(el: HTMLElement): boolean {
  const a = el.querySelector("a");
  if (!a) return false;
  const l = lettersOnly(a.text).length;
  return l >= 4 && l / Math.max(1, lettersOnly(el.text).length) >= 0.7;
}
const boldLead = (el: HTMLElement) => !el.querySelector("a") && clean(el.text).length < 60 && wholly(el, "strong, b");

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
  const push = (el: HTMLElement, kind: Chunk["kind"], grp?: string, extra: { title?: string; details?: string } = {}) => {
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
    const title = (extra.title ?? (lead || text))
      .replace(/\s*[\u{1F300}-\u{1FAFF}]\s*$/u, "")
      .slice(0, 90);
    const body =
      extra.title ? text : lead && text.startsWith(lead)
        ? clean(text.slice(lead.length))
        : lead
          ? text
          : "";
    const em = kind === "bullet" ? el.querySelector("em") : null;
    const dateLine = em ? clean(em.text) : null;
    const parts = dateLine ? dateLine.split(/\s+[—–-]\s+/) : [];
    // An entry built from several paragraphs ("🎪 Title", description, details) has its emoji and title cut out wherever they sit.
    const merged = el.tagName.toLowerCase() === "div";
    let rest = merged ? text.replace(extra.title ?? lead, "").replace(/^[^\p{L}\p{N}]+/u, "") : lead && text.startsWith(lead) ? text.slice(lead.length) : text;
    if (dateLine) rest = rest.replace(dateLine, "");
    const details = extra.details ? readDetails(extra.details) : null;
    if (details) rest = rest.replace(clean(extra.details!), "");
    let when = dateLine ? (parts.length > 1 ? parts.slice(0, -1).join(" — ") : dateLine) : (details?.when ?? null);
    const place = parts.length > 1 ? parts[parts.length - 1] : (details?.place ?? null);
    // Under a "Friday" subheading the day is the heading's: "7:30pm" becomes "Friday 7:30pm".
    const day = WEEKDAY_HEADING.exec(section)?.[1];
    if (day && !(when && HAS_DAY.test(when))) when = `${clean(day)}${when ? ` ${when}` : ""}`;
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
      blurb: capitalize(clean(rest).replace(LEAD_PUNCT, "")),
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
      } else if (titleOnlyLink(n) || (boldLead(n) && next === "p")) {
        // An entry spread over paragraphs: a title (a link, or a bold venue name), then its description and a details line.
        const parts: HTMLElement[] = [n];
        let j = i + 1;
        while (j < nodes.length && parts.length < 4 && nodes[j].tagName.toLowerCase() === "p" && clean(nodes[j].text) && !titleOnlyLink(nodes[j]) && !boldLead(nodes[j]) && nodes[j + 1]?.tagName?.toLowerCase() !== "ul") parts.push(nodes[j++]);
        if (parts.length === 1) push(n, "paragraph");
        else {
          const merged = parse(`<div>${parts.map((x) => x.outerHTML).join(" ")}</div>`).firstChild as HTMLElement;
          const details = parts.slice(1).map((x) => clean(x.text)).find((t) => readDetails(t));
          push(merged, "paragraph", undefined, { title: boldLead(n) ? clean(n.text) : undefined, details });
          i = j - 1;
        }
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
