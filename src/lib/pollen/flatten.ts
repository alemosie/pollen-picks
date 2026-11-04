import { HTMLElement } from "node-html-parser";

// Some newsletters are built from plain <div>s, <b> and <a> instead of headings, paragraphs and lists (an event is a card:
// a bold link, a description line, a "place | time | price" line). The parsers read headings, paragraphs and lists, so this
// turns such a layout into those, by shape alone (it knows nothing about any one newsletter):
//   - a block holding only text and inline tags is a paragraph; a short one with no link is a heading
//   - a container made only of such blocks, with a link and more than one line, is one card: one list item
// Everything else is looked through. Navigation, footers, scripts, polls and "Jump to" anchor lines are dropped.

const INLINE = /^(a|b|strong|i|em|u|span|br|small|sup|sub|mark|s|code)$/i;
const BLOCK = /^(h[1-6]|p|ul|ol)$/i;
const SKIP = /^(script|style|nav|header|footer|noscript|template|iframe|form|svg)$/i;
const POLL = /\b(poll|vote|how did you like|rate this)\b/i;

const elements = (el: HTMLElement) => el.childNodes.filter((n): n is HTMLElement => n instanceof HTMLElement);
const text = (el: HTMLElement) => el.text.replace(/\s+/g, " ").trim();
const isLeaf = (el: HTMLElement) => elements(el).every((c) => INLINE.test(c.tagName) || /^img$/i.test(c.tagName));
const links = (el: HTMLElement) => el.querySelectorAll("a");
/** A "Jump to: Friday | Saturday" line: every link points at the same page. */
const isAnchorNav = (el: HTMLElement) => {
  const a = links(el);
  return a.length > 0 && a.every((l) => (l.getAttribute("href") ?? "").startsWith("#"));
};
const isLabel = (el: HTMLElement) => {
  const t = text(el);
  return t.length > 0 && t.length < 60 && links(el).length === 0;
};

function emit(el: HTMLElement, out: string[]): void {
  const kids = elements(el).filter((c) => !SKIP.test(c.tagName) && !/^img$/i.test(c.tagName));
  if (kids.length === 0) return;
  const leaves = kids.filter((c) => isLeaf(c) && text(c).length > 0);

  // A list: only text blocks, and most of them have their own link ("Quick picks"). A short link-less first line is its heading.
  if (leaves.length === kids.length && leaves.filter((c) => links(c).length > 0).length >= 3) {
    const head = isLabel(leaves[0]) ? leaves[0] : null;
    if (head) out.push(`<h2>${text(head)}</h2>`);
    out.push(`<ul>${leaves.slice(head ? 1 : 0).map((c) => `<li>${c.innerHTML}</li>`).join("")}</ul>`);
    return;
  }

  // A card: only text blocks, at least two of them, and a link somewhere. A short link-less first line ("FEATURED EVENT") is a tag, not text.
  if (kids.length >= 2 && leaves.length === kids.length && links(el).length > 0) {
    const lines = isLabel(leaves[0]) ? leaves.slice(1) : leaves;
    if (lines.length > 0) {
      out.push(`<ul><li>${lines.map((c) => `<p>${c.innerHTML}</p>`).join("")}</li></ul>`);
      return;
    }
  }

  for (const c of kids) {
    const tag = c.tagName.toLowerCase();
    if (tag === "table" && POLL.test(text(c))) continue;
    if (BLOCK.test(tag)) out.push(c.outerHTML);
    else if (isLeaf(c)) {
      if (!text(c) || isAnchorNav(c)) continue;
      out.push(isLabel(c) ? `<h2>${text(c)}</h2>` : `<p>${c.innerHTML}</p>`);
    } else emit(c, out);
  }
}

/** Flat headings, paragraphs and lists from a div-based post body. */
export function flattenLayout(container: HTMLElement): string {
  const out: string[] = [];
  emit(container, out);
  return out.join("\n");
}
