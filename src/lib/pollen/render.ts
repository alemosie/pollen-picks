import { HTMLElement, parse } from "node-html-parser";

// Turns beehiiv's rendered page into a document that is safe to show in a sandboxed iframe: only the post body, with the
// page's own styles, and nothing that can run. The iframe is also sandboxed without scripts and the document carries a
// content-security policy, so this strips on top of those, it is not the only defence.

const REMOVE = "script, noscript, iframe, object, embed, form, input, button, textarea, select, base, meta, template, link[rel=preload], link[rel=prefetch], link[rel=modulepreload]";
const BAD_URL = /^\s*(javascript|vbscript|data\s*:\s*text\/html)/i;
const URL_ATTRS = ["href", "src", "srcset", "action", "formaction", "xlink:href", "poster"];

export function sanitize(el: HTMLElement) {
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

// ---- Any public page ----

const NOISE = "nav, header, footer, aside, form, button, svg, canvas, dialog, [role=navigation], [role=banner], [role=complementary], [aria-hidden=true]";
const NOISE_CLASS = /(^|[\s_-])(subscribe|subscription|share|paywall|comments?|footer|navbar|sidebar|related|newsletter-signup|signup|popup|modal|cookie|ad|ads|advert)([\s_-]|$)/i;
const CONTAINERS = ["#content-blocks", ".available-content", ".post-content", ".entry-content", "article", "[role=main]", "main"];

const PAGE_CSS = `
html{overflow-y:hidden}
body{margin:0;padding:16px;font:17px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif;color:#2b3a36;background:#fffaf3}
.pp-page{max-width:42rem;margin:0 auto}
h1,h2,h3,h4{line-height:1.25;margin:1.4em 0 .5em}
img,video{max-width:100%;height:auto;border-radius:8px}
a{color:inherit;cursor:text}
table{max-width:100%}
blockquote{margin:1em 0;padding-left:1em;border-left:3px solid #f6bd60}
::selection{background:#f6bd60;color:#1f2a27}
`;

/** Relative addresses become absolute, so images and links keep working inside our own document. */
function absolutize(root: HTMLElement, base: string) {
  const fix = (v: string) => {
    if (!v || v.startsWith("#") || /^(mailto|tel|data|javascript):/i.test(v)) return v;
    try {
      return new URL(v, base).href;
    } catch {
      return v;
    }
  };
  for (const el of root.querySelectorAll("[href], [src], [poster], [srcset]")) {
    for (const a of ["href", "src", "poster"]) {
      const v = el.getAttribute(a);
      if (v) el.setAttribute(a, fix(v));
    }
    const set = el.getAttribute("srcset");
    if (set) el.setAttribute("srcset", set.split(",").map((c) => { const [u, ...rest] = c.trim().split(/\s+/); return [fix(u), ...rest].join(" "); }).join(", "));
  }
}

export type PublicPage = { html: string; title: string; site: string | null };

/**
 * A public newsletter or blog post as a document for the Manual tab: the article, without the site around it. beehiiv pages
 * keep their own look; anything else gets a plain reading style of ours. null when no readable text was found.
 */
export function renderablePublicPage(html: string, pageUrl: string): PublicPage | null {
  const root = parse(html);
  const meta = (n: string) => root.querySelector(`meta[property="${n}"], meta[name="${n}"]`)?.getAttribute("content")?.trim() || null;
  const title = (meta("og:title") ?? root.querySelector("title")?.text.trim() ?? "").slice(0, 200) || pageUrl;
  const site = meta("og:site_name")?.slice(0, 100) ?? null;
  absolutize(root, pageUrl);

  if (root.querySelector("#content-blocks")) {
    const doc = renderableDocument(root.toString());
    return doc ? { html: doc, title, site } : null;
  }

  const picked = CONTAINERS.map((s) => root.querySelector(s)).find((e) => e && e.text.replace(/\s+/g, " ").trim().length >= 200);
  const container = picked ?? root.querySelector("body");
  if (!container) return null;
  const copy = parse(`<div class="pp-page">${container.innerHTML}</div>`);
  const el = copy.querySelector("div")!;
  for (const n of el.querySelectorAll(NOISE)) n.remove();
  for (const n of el.querySelectorAll("[class]")) if (NOISE_CLASS.test(n.getAttribute("class") ?? "")) n.remove();
  sanitize(el);
  if (el.text.replace(/\s+/g, " ").trim().length < 100) return null;
  return {
    title,
    site,
    html: [
      "<!doctype html><html><head>",
      '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src data:; media-src https:">`,
      `<style>${PAGE_CSS}</style>`,
      "</head><body>",
      el.outerHTML,
      "</body></html>",
    ].join("\n"),
  };
}
