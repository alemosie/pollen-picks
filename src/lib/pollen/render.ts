import { HTMLElement, parse } from "node-html-parser";

// Turns beehiiv's rendered page into a document that is safe to show in a sandboxed iframe: only the post body, with the
// page's own styles, and nothing that can run. The iframe is also sandboxed without scripts and the document carries a
// content-security policy, so this strips on top of those, it is not the only defence.

const REMOVE = "script, noscript, iframe, object, embed, form, input, button, textarea, select, base, meta, template, link[rel=preload], link[rel=prefetch], link[rel=modulepreload]";
const BAD_URL = /^\s*(javascript|vbscript|data\s*:\s*text\/html)/i;
const URL_ATTRS = ["href", "src", "srcset", "action", "formaction", "xlink:href", "poster"];

function sanitize(el: HTMLElement) {
  for (const bad of el.querySelectorAll(REMOVE)) bad.remove();
  for (const node of [el, ...el.querySelectorAll("*")]) {
    for (const name of Object.keys(node.attributes)) {
      const lower = name.toLowerCase();
      if (lower.startsWith("on") || lower === "srcdoc") node.removeAttribute(name);
      else if (URL_ATTRS.includes(lower) && BAD_URL.test(node.getAttribute(name) ?? "")) node.removeAttribute(name);
    }
  }
}

const OUR_CSS = `
html{overflow-y:hidden}
body{margin:0;padding:16px}
img,video{max-width:100%;height:auto}
a{cursor:text}
::selection{background:#f6bd60;color:#1f2a27}
`;

/** The post body as a standalone HTML document, or null when the page has no recognisable body. */
export function renderableDocument(html: string): string | null {
  const root = parse(html);
  const content = root.querySelector("#content-blocks");
  let body: string;
  let bodyAttrs = "";
  if (content) {
    // Keep the wrappers around the body (they carry the theme classes) but not their other children: the site's chrome.
    body = content.outerHTML;
    let node: HTMLElement | null = content.parentNode as HTMLElement | null;
    while (node && node.tagName && node.rawTagName.toLowerCase() !== "body" && node.rawTagName.toLowerCase() !== "html") {
      body = `<${node.rawTagName}${node.rawAttrs ? ` ${node.rawAttrs}` : ""}>${body}</${node.rawTagName}>`;
      node = node.parentNode as HTMLElement | null;
    }
    bodyAttrs = root.querySelector("body")?.rawAttrs ?? "";
  } else if (!/<html|<body/i.test(html)) {
    body = html; // editor-style fragment: no page around it
  } else {
    return null;
  }

  const styles = root
    .querySelectorAll("style, link[rel=stylesheet]")
    .filter((e) => e.rawTagName.toLowerCase() === "style" || /^https:\/\//i.test(e.getAttribute("href") ?? ""))
    .map((e) => e.outerHTML)
    .join("\n");

  const doc = parse(`<body ${bodyAttrs}>${body}</body>`);
  const el = doc.querySelector("body")!;
  sanitize(el);
  return [
    "<!doctype html><html><head>",
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline' https:; font-src https: data:; media-src https:">`,
    styles,
    `<style>${OUR_CSS}</style>`,
    "</head>",
    el.outerHTML,
    "</html>",
  ].join("\n");
}
