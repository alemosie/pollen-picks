import { HTMLElement, parse } from "node-html-parser";

const BLOCK = /^(h[1-6]|p|ul|ol)$/i;

/**
 * The parsers read headings, paragraphs and lists at the top level, which is how beehiiv's editor HTML (and the saved
 * fixtures) look. A rendered web page may wrap the same blocks in a few containers, so find the element that holds the
 * most blocks and return its inner HTML. Already-flat HTML is returned untouched.
 */
export function contentRoot(html: string): string {
  const root = parse(html);
  const blocks = (el: HTMLElement) => el.childNodes.filter((n): n is HTMLElement => n instanceof HTMLElement && BLOCK.test(n.tagName)).length;
  let best: HTMLElement = root;
  let bestCount = blocks(root);
  const walk = (el: HTMLElement) => {
    for (const c of el.childNodes) {
      if (!(c instanceof HTMLElement) || /^(script|style|nav|header|footer)$/i.test(c.tagName)) continue;
      const n = blocks(c);
      if (n > bestCount) {
        best = c;
        bestCount = n;
      }
      walk(c);
    }
  };
  walk(root);
  return best === root ? html : best.innerHTML;
}
