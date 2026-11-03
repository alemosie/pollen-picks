import { HTMLElement, parse } from "node-html-parser";

const BLOCK = /^(h[1-6]|p|ul|ol)$/i;
const SKIP = /^(script|style|nav|header|footer|noscript|template)$/i;

const elements = (el: HTMLElement) => el.childNodes.filter((n): n is HTMLElement => n instanceof HTMLElement);
const directBlocks = (el: HTMLElement) => elements(el).filter((c) => BLOCK.test(c.tagName)).length;

/** An image block: a figure, or a wrapper that holds an <img> directly. Its caption belongs to the image, not to the text. */
const isImageBlock = (el: HTMLElement) => /^(figure|picture)$/i.test(el.tagName) || elements(el).some((c) => /^(img|picture)$/i.test(c.tagName));

/**
 * Headings, paragraphs and lists found by walking down through wrapper elements (each block may sit in its own div).
 * Image blocks are left out with their captions: the picks are text, and a caption without its picture reads as a stray line.
 */
function collectBlocks(el: HTMLElement, out: HTMLElement[] = []): HTMLElement[] {
  for (const c of elements(el)) {
    if (SKIP.test(c.tagName)) continue;
    if (BLOCK.test(c.tagName)) out.push(c);
    else if (!isImageBlock(c)) collectBlocks(c, out);
  }
  return out;
}

/** beehiiv's web page writes italics and bold as <i> and <b>; the parsers look for <em> and <strong>. */
const semantic = (html: string) =>
  html
    .replace(/<i(?=[\s>])/gi, "<em")
    .replace(/<\/i>/gi, "</em>")
    .replace(/<b(?=[\s>])/gi, "<strong")
    .replace(/<\/b>/gi, "</strong>");

/**
 * The parsers read headings, paragraphs and lists at the top level, which is how beehiiv's editor HTML (and the saved
 * fixtures) look. The rendered web page that beehiiv's API returns is a whole document: the post body sits in
 * #content-blocks with every block wrapped in its own div. Find the post body, lift the blocks out of their wrappers,
 * and return them as flat HTML. Already-flat HTML is returned untouched.
 */
export function contentRoot(html: string): string {
  const root = parse(html);
  if (directBlocks(root) > 0 && !root.querySelector("#content-blocks")) return html;

  let container: HTMLElement | null = root.querySelector("#content-blocks");
  if (!container) {
    // Unknown wrapper: the element holding the most blocks once wrappers are looked through.
    let bestCount = 0;
    const walk = (el: HTMLElement) => {
      for (const c of elements(el)) {
        if (SKIP.test(c.tagName)) continue;
        const n = directBlocks(c);
        if (n > bestCount) {
          container = c;
          bestCount = n;
        }
        walk(c);
      }
    };
    walk(root);
  }
  if (!container) return html;
  const body = container as HTMLElement;
  const blocks = collectBlocks(body);
  // A container that already holds its blocks directly (the old behaviour) keeps its inner HTML as it was.
  if (blocks.length === directBlocks(body)) return semantic(body.innerHTML);
  return semantic(blocks.map((b) => b.outerHTML).join("\n"));
}
